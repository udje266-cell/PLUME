/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Surcouche d'appel de GROUPE : invitation entrante (rejoindre/refuser) et
 * appel en cours (participants, micro, raccrocher).
 */

import React, { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Users } from 'lucide-react';
import type { User, ReadingGroup } from '../types';

interface GroupCallOverlayProps {
  activeGroupId: string | null;
  participantIds: string[]; // pairs distants connectés
  invite: { groupId: string; from: string } | null;
  groups: ReadingGroup[];
  allUsers: User[];
  currentUser: User;
  onAccept: () => void;
  onDecline: () => void;
  onLeave: () => void;
  onToggleMute: () => boolean;
}

export default function GroupCallOverlay({
  activeGroupId, participantIds, invite, groups, allUsers, currentUser, onAccept, onDecline, onLeave, onToggleMute,
}: GroupCallOverlayProps) {
  const [muted, setMuted] = useState(false);

  // Invitation entrante (et pas déjà dans cet appel)
  if (invite && invite.groupId !== activeGroupId) {
    const group = groups.find((g) => g.id === invite.groupId);
    const caller = allUsers.find((u) => u.id === invite.from);
    return (
      <div className="fixed inset-0 z-[100] bg-[#0E0E14]/95 backdrop-blur-sm flex flex-col items-center justify-between py-16 animate-fade-in select-none" style={{ paddingTop: 'max(4rem, env(safe-area-inset-top))', paddingBottom: 'max(4rem, env(safe-area-inset-bottom))' }}>
        <div className="flex flex-col items-center space-y-4 mt-10">
          <div className="w-24 h-24 rounded-2xl bg-purple-700 flex items-center justify-center text-white animate-pulse overflow-hidden">
            {group?.avatar ? <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Users className="w-10 h-10" />}
          </div>
          <h2 className="text-xl font-bold text-white">{group?.name || 'Groupe'}</h2>
          <p className="text-sm text-purple-300">Appel de groupe — {caller?.username || 'un membre'} appelle…</p>
        </div>
        <div className="flex items-center gap-8">
          <button onClick={onDecline} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg active:scale-95" aria-label="Refuser">
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <button onClick={onAccept} className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center shadow-lg active:scale-95 animate-bounce" aria-label="Rejoindre">
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>
    );
  }

  if (!activeGroupId) return null;

  const group = groups.find((g) => g.id === activeGroupId);
  // Participants visibles : moi + les pairs connectés.
  const ids = [currentUser.id, ...participantIds];
  const people = ids.map((id) => allUsers.find((u) => u.id === id)).filter(Boolean) as User[];

  return (
    <div className="fixed inset-0 z-[100] bg-[#0E0E14]/95 backdrop-blur-sm flex flex-col items-center justify-between py-14 animate-fade-in select-none" style={{ paddingTop: 'max(3.5rem, env(safe-area-inset-top))', paddingBottom: 'max(3.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex flex-col items-center space-y-3 mt-6">
        <div className="w-16 h-16 rounded-2xl bg-purple-700 flex items-center justify-center text-white overflow-hidden">
          {group?.avatar ? <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Users className="w-7 h-7" />}
        </div>
        <h2 className="text-lg font-bold text-white">{group?.name || 'Appel de groupe'}</h2>
        <p className="text-xs text-purple-300">{participantIds.length + 1} participant{participantIds.length ? 's' : ''} · en cours…</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 max-w-md px-6">
        {people.map((u) => (
          <div key={u.id} className="flex flex-col items-center gap-1">
            {u.avatar
              ? <img src={u.avatar} alt={u.username} className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-600/40" referrerPolicy="no-referrer" />
              : <div className="w-16 h-16 rounded-full bg-purple-700 flex items-center justify-center text-2xl text-white font-bold">{u.username.charAt(0).toUpperCase()}</div>}
            <span className="text-[10px] text-zinc-300 truncate max-w-[70px]">{u.id === currentUser.id ? 'Vous' : u.username}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={() => setMuted(onToggleMute())}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 ${muted ? 'bg-white text-zinc-900' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}
          aria-label={muted ? 'Réactiver le micro' : 'Couper le micro'}
        >
          {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button onClick={onLeave} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg active:scale-95" aria-label="Raccrocher">
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}
