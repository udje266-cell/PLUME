/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gestion des appels audio en pair-à-pair (WebRTC).
 *
 * Le flux audio est P2P : il ne transite PAS par le serveur. Le serveur ne sert
 * qu'à relayer la signalisation (offre/réponse SDP + candidats ICE) via
 * Socket.io. Les serveurs STUN servent à découvrir l'adresse publique ; le
 * serveur TURN (gratuit, public) relaie le média uniquement si le NAT est trop
 * strict pour une connexion directe.
 */

import type { Socket } from 'socket.io-client';
import { getIceServers } from './iceConfig';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

export interface CallPeer {
  id: string;
  name?: string;
  avatar?: string;
}


export interface CallCallbacks {
  onStatus: (status: CallStatus) => void;
  onIncoming: (peer: CallPeer) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onError: (message: string) => void;
}

export class CallManager {
  private socket: Socket;
  private cb: CallCallbacks;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private peerId: string | null = null;
  private incomingSdp: RTCSessionDescriptionInit | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteReady = false;

  constructor(socket: Socket, callbacks: CallCallbacks) {
    this.socket = socket;
    this.cb = callbacks;
    this.bind();
  }

  private bind() {
    this.socket.on('call:incoming', ({ from, caller, sdp }: any) => {
      // Si déjà en appel, on refuse poliment (occupé).
      if (this.pc) { this.socket.emit('call:reject', { to: from }); return; }
      this.peerId = from;
      this.incomingSdp = sdp;
      this.cb.onIncoming({ id: from, name: caller?.name, avatar: caller?.avatar });
      this.cb.onStatus('incoming');
    });

    this.socket.on('call:answered', async ({ sdp }: any) => {
      if (!this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.remoteReady = true;
        await this.flushCandidates();
      } catch { this.cb.onError("Échec de l'établissement de l'appel."); this.cleanup(); }
    });

    this.socket.on('call:ice', async ({ candidate }: any) => {
      if (!candidate) return;
      if (!this.pc || !this.remoteReady) { this.pendingCandidates.push(candidate); return; }
      try { await this.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
    });

    this.socket.on('call:rejected', () => { this.cb.onError('Appel refusé ou occupé.'); this.cleanup(); });
    this.socket.on('call:ended', () => { this.cleanup(); });
  }

  /** Crée la connexion P2P et branche le micro local + le flux distant. */
  private async createPeer(): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: await getIceServers() });

    // Réducteur de bruit parasite intégré (activé par défaut, ajustable en appel).
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { noiseSuppression: this.noiseReduction, echoCancellation: this.noiseReduction, autoGainControl: this.noiseReduction } as MediaTrackConstraints,
      video: false,
    });
    this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    const remote = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      this.cb.onRemoteStream(remote);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && this.peerId) {
        this.socket.emit('call:ice', { to: this.peerId, candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') this.cb.onStatus('connected');
      else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        if (this.pc) { this.cb.onError('Connexion perdue.'); this.cleanup(); }
      }
    };

    this.pc = pc;
    return pc;
  }

  private async flushCandidates() {
    if (!this.pc) return;
    for (const c of this.pendingCandidates) {
      try { await this.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
    this.pendingCandidates = [];
  }

  /** Lance un appel sortant vers un utilisateur. */
  async startCall(peer: CallPeer, me: CallPeer) {
    if (this.pc) return;
    this.peerId = peer.id;
    this.cb.onStatus('calling');
    try {
      const pc = await this.createPeer();
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      this.socket.emit('call:offer', {
        to: peer.id,
        sdp: offer,
        caller: { id: me.id, name: me.name, avatar: me.avatar },
      });
    } catch (e: any) {
      this.cb.onError(this.micError(e));
      this.cleanup();
    }
  }

  /** Accepte un appel entrant. */
  async accept() {
    if (!this.peerId || !this.incomingSdp) return;
    try {
      const pc = await this.createPeer();
      await pc.setRemoteDescription(new RTCSessionDescription(this.incomingSdp));
      this.remoteReady = true;
      await this.flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('call:answer', { to: this.peerId, sdp: answer });
    } catch (e: any) {
      this.cb.onError(this.micError(e));
      this.cleanup();
    }
  }

  /** Refuse un appel entrant. */
  reject() {
    if (this.peerId) this.socket.emit('call:reject', { to: this.peerId });
    this.cleanup();
  }

  /** Raccroche / annule un appel en cours ou sortant. */
  end() {
    if (this.peerId) this.socket.emit('call:end', { to: this.peerId });
    this.cleanup();
  }

  /** Coupe / réactive le micro. Renvoie true si désormais coupé. */
  toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled;
  }

  // Réducteur de bruit parasite : activable/désactivable en cours d'appel.
  private noiseReduction = true;
  isNoiseReduction(): boolean { return this.noiseReduction; }
  async setNoiseReduction(on: boolean): Promise<boolean> {
    this.noiseReduction = on;
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({ noiseSuppression: on, echoCancellation: on, autoGainControl: on } as MediaTrackConstraints);
      } catch { /* certains appareils ne supportent pas l'ajustement a chaud */ }
    }
    return this.noiseReduction;
  }

  private micError(e: any): string {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
      return 'Accès au micro refusé. Autorise le microphone pour passer un appel.';
    }
    if (e?.name === 'NotFoundError') return 'Aucun microphone détecté sur cet appareil.';
    return "Impossible de démarrer l'appel audio.";
  }

  private cleanup() {
    try { this.pc?.getSenders().forEach((s) => s.track?.stop()); } catch { /* ignore */ }
    try { this.localStream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { this.pc?.close(); } catch { /* ignore */ }
    this.pc = null;
    this.localStream = null;
    this.peerId = null;
    this.incomingSdp = null;
    this.pendingCandidates = [];
    this.remoteReady = false;
    this.cb.onStatus('idle');
  }

  dispose() {
    this.socket.off('call:incoming');
    this.socket.off('call:answered');
    this.socket.off('call:ice');
    this.socket.off('call:rejected');
    this.socket.off('call:ended');
    this.cleanup();
  }
}
