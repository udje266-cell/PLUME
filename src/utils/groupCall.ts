/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Appels de GROUPE audio en MAILLAGE (mesh) WebRTC : chaque participant établit
 * une connexion pair-à-pair avec chacun des autres. Adapté aux petits groupes
 * (cercles de lecture). Le flux audio reste P2P ; le serveur ne relaie que la
 * signalisation. Règle anti-glare : le NOUVEL arrivant initie les offres vers
 * les participants déjà présents ; ceux-ci attendent l'offre.
 */

import type { Socket } from 'socket.io-client';
import { getIceServers } from './iceConfig';


export interface GroupCallCallbacks {
  onActive: (active: boolean) => void;
  onParticipants: (userIds: string[]) => void;
  onError: (message: string) => void;
}

interface PeerEntry { pc: RTCPeerConnection; audio: HTMLAudioElement; }

export class GroupCallManager {
  private socket: Socket;
  private cb: GroupCallCallbacks;
  private groupId: string | null = null;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, PeerEntry>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();

  constructor(socket: Socket, callbacks: GroupCallCallbacks) {
    this.socket = socket;
    this.cb = callbacks;
    this.bind();
  }

  get isActive() { return this.groupId !== null; }
  get currentGroupId() { return this.groupId; }

  private bind() {
    this.socket.on('group_call:participants', async ({ groupId, userIds }: any) => {
      if (groupId !== this.groupId) return;
      for (const id of userIds || []) await this.createPeer(id, true); // je suis le nouvel arrivant
    });
    this.socket.on('group_call:participant_left', ({ groupId, userId }: any) => {
      if (groupId !== this.groupId) return;
      this.closePeer(userId);
    });
    this.socket.on('group_call:offer', async ({ groupId, from, sdp }: any) => {
      if (groupId !== this.groupId) return;
      const pc = await this.createPeer(from, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await this.flushIce(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('group_call:answer', { groupId, to: from, sdp: answer });
      } catch { this.closePeer(from); }
    });
    this.socket.on('group_call:answer', async ({ groupId, from, sdp }: any) => {
      if (groupId !== this.groupId) return;
      const entry = this.peers.get(from);
      if (entry) {
        try { await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp)); await this.flushIce(from); } catch { /* ignore */ }
      }
    });
    this.socket.on('group_call:ice', async ({ groupId, from, candidate }: any) => {
      if (groupId !== this.groupId || !candidate) return;
      const entry = this.peers.get(from);
      if (entry && entry.pc.remoteDescription) {
        try { await entry.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
      } else {
        const arr = this.pendingIce.get(from) || [];
        arr.push(candidate);
        this.pendingIce.set(from, arr);
      }
    });
  }

  async join(groupId: string, memberIds: string[]) {
    if (this.groupId) return;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true } as MediaTrackConstraints,
        video: false,
      });
    } catch (e: any) {
      this.cb.onError(e?.name === 'NotAllowedError' ? 'Accès au micro refusé.' : "Impossible de démarrer l'appel de groupe.");
      return;
    }
    this.groupId = groupId;
    this.cb.onActive(true);
    this.socket.emit('group_call:join', { groupId, memberIds });
  }

  private async createPeer(peerId: string, initiator: boolean): Promise<RTCPeerConnection> {
    const existing = this.peers.get(peerId);
    if (existing) return existing.pc;

    const pc = new RTCPeerConnection({ iceServers: await getIceServers() });
    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    const audio = new Audio();
    audio.autoplay = true;
    const remote = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      audio.srcObject = remote;
      audio.play().catch(() => {});
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && this.groupId) {
        this.socket.emit('group_call:ice', { groupId: this.groupId, to: peerId, candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.closePeer(peerId);
    };

    this.peers.set(peerId, { pc, audio });
    this.emitParticipants();

    if (initiator) {
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        this.socket.emit('group_call:offer', { groupId: this.groupId, to: peerId, sdp: offer });
      } catch { this.closePeer(peerId); }
    }
    return pc;
  }

  private async flushIce(peerId: string) {
    const entry = this.peers.get(peerId);
    const arr = this.pendingIce.get(peerId);
    if (entry && arr) {
      for (const c of arr) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } }
      this.pendingIce.delete(peerId);
    }
  }

  private closePeer(peerId: string) {
    const entry = this.peers.get(peerId);
    if (entry) { try { entry.pc.close(); } catch { /* ignore */ } entry.audio.srcObject = null; this.peers.delete(peerId); }
    this.pendingIce.delete(peerId);
    this.emitParticipants();
  }

  private emitParticipants() {
    this.cb.onParticipants(Array.from(this.peers.keys()));
  }

  toggleMute(): boolean {
    const t = this.localStream?.getAudioTracks()[0];
    if (!t) return false;
    t.enabled = !t.enabled;
    return !t.enabled;
  }

  leave() {
    if (this.groupId) this.socket.emit('group_call:leave', { groupId: this.groupId });
    Array.from(this.peers.keys()).forEach((id) => this.closePeer(id));
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.groupId = null;
    this.cb.onActive(false);
    this.cb.onParticipants([]);
  }

  dispose() {
    ['group_call:participants', 'group_call:participant_left', 'group_call:offer', 'group_call:answer', 'group_call:ice']
      .forEach((e) => this.socket.off(e));
    this.leave();
  }
}
