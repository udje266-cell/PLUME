/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Surcouche d'appel audio (entrant / sortant / en cours). Affichée par-dessus
 * toute l'app dès qu'un appel est actif. Le son distant est joué via un
 * <audio> caché alimenté par le flux WebRTC.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Waves } from 'lucide-react';
import type { CallStatus, CallPeer } from '../utils/webrtcCall';

interface CallOverlayProps {
  status: CallStatus;
  peer: CallPeer | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => boolean;
  onToggleNoise?: (on: boolean) => void;
}

export default function CallOverlay({
  status, peer, remoteStream, onAccept, onReject, onHangup, onToggleMute, onToggleNoise,
}: CallOverlayProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [noiseOn, setNoiseOn] = useState(true);
  const [seconds, setSeconds] = useState(0);

  // Branche le flux audio distant sur l'élément <audio>.
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(() => { /* lecture auto bloquée : ignorée */ });
    }
  }, [remoteStream]);

  // Chronomètre une fois l'appel connecté.
  useEffect(() => {
    if (status !== 'connected') { setSeconds(0); return; }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => { if (status === 'idle') { setMuted(false); setNoiseOn(true); } }, [status]);

  if (status === 'idle' || status === 'ended') return null;

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const name = peer?.name || 'Utilisateur';
  const label =
    status === 'incoming' ? 'Appel entrant…' :
    status === 'calling' ? 'Appel en cours…' :
    status === 'connected' ? fmt(seconds) : '';

  return (
    <div className="fixed inset-0 z-[100] bg-[#0E0E14]/95 backdrop-blur-sm flex flex-col items-center justify-between py-16 animate-fade-in select-none">
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Identité du correspondant */}
      <div className="flex flex-col items-center space-y-5 mt-10">
        <div className={`relative ${status !== 'connected' ? 'animate-pulse' : ''}`}>
          {peer?.avatar ? (
            <img src={peer.avatar} alt={name} className="w-28 h-28 rounded-full object-cover ring-4 ring-purple-600/40" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-purple-700 flex items-center justify-center text-4xl font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <h2 className="text-2xl font-bold text-white">{name}</h2>
        <p className="text-sm text-purple-300 font-medium tracking-wide flex items-center gap-2">
          <Phone className="w-4 h-4" /> {label}
        </p>
      </div>

      {/* Commandes */}
      <div className="flex items-center justify-center gap-8">
        {status === 'incoming' ? (
          <>
            <button
              id="call-reject-btn"
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg active:scale-95 transition"
              aria-label="Refuser"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <button
              id="call-accept-btn"
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center shadow-lg active:scale-95 transition animate-bounce"
              aria-label="Accepter"
            >
              <Phone className="w-7 h-7 text-white" />
            </button>
          </>
        ) : (
          <>
            {status === 'connected' && (
              <button
                id="call-mute-btn"
                onClick={() => setMuted(onToggleMute())}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition ${muted ? 'bg-white text-zinc-900' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}
                aria-label={muted ? 'Réactiver le micro' : 'Couper le micro'}
              >
                {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
            )}
            {status === 'connected' && (
              <button
                id="call-noise-btn"
                onClick={() => { const next = !noiseOn; setNoiseOn(next); onToggleNoise?.(next); }}
                className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition ${noiseOn ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}
                aria-label={noiseOn ? 'Désactiver le réducteur de bruit' : 'Activer le réducteur de bruit'}
                title={noiseOn ? 'Réducteur de bruit : activé' : 'Réducteur de bruit : désactivé'}
              >
                <Waves className="w-6 h-6" />
                {!noiseOn && <span className="absolute inset-0 m-auto w-7 h-0.5 bg-white rotate-45 rounded" />}
              </button>
            )}
            <button
              id="call-hangup-btn"
              onClick={onHangup}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg active:scale-95 transition"
              aria-label="Raccrocher"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
