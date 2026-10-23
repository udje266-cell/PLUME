import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Image, Lock, ShieldAlert, Trash2, UserRound, X } from 'lucide-react';
import { authHeaders } from '../utils/auth';

export default function ConversationMenu({ name, userId, blocked, onClose, onBackground, onProfile, onBlock, onDelete, group }: {
  name: string; userId?: string; blocked: boolean; onClose: () => void; onBackground: () => void; onProfile: () => void;
  onBlock?: () => Promise<boolean>; onDelete?: () => Promise<boolean>; group: boolean;
}) {
  const [reporting, setReporting] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reported, setReported] = useState(false);
  const run = async (action: (() => Promise<boolean>) | undefined) => {
    if (!action || busy) return;
    setBusy(true); setError('');
    try { if (await action()) onClose(); else setError('La modification n’a pas pu être enregistrée. Réessayez.'); }
    catch { setError('Connexion interrompue. Réessayez.'); } finally { setBusy(false); }
  };
  return createPortal(<div className="fixed inset-0 z-[2147483100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Options de la conversation" onKeyDown={event => { if (event.key === 'Escape' && !busy) onClose(); }} onClick={event => event.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#171726] text-zinc-900 dark:text-white border border-purple-500/20 p-3 shadow-2xl">
      <div className="flex items-center justify-between p-2 mb-1"><h2 className="text-sm font-semibold">{reporting ? 'Signaler cette personne' : 'Options de la conversation'}</h2><button autoFocus type="button" aria-label="Fermer les options" onClick={onClose} className="p-2"><X className="w-4 h-4" /></button></div>
      {error && <p role="alert" className="px-2 text-xs text-rose-500">{error}</p>}
      {reported ? <p role="status" className="p-3 text-sm">Votre signalement a été transmis à la modération.</p> : reporting ? <form onSubmit={async event => { event.preventDefault(); if (!reason.trim() || busy) return; setBusy(true); setError(''); try { const response = await fetch(`/api/users/${encodeURIComponent(userId!)}/report`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ reason }) }); if (!response.ok) throw new Error(); setReported(true); } catch { setError('Le signalement n’a pas pu être envoyé. Réessayez.'); } finally { setBusy(false); } }} className="p-2 space-y-3"><label className="block text-xs">Motif du signalement<textarea autoFocus aria-label="Motif du signalement" maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-xl p-3 bg-zinc-100 dark:bg-zinc-900 text-sm" rows={4} /></label><button disabled={busy || !reason.trim()} className="w-full rounded-xl bg-purple-600 text-white text-xs py-3 disabled:opacity-50">{busy ? 'Envoi…' : 'Envoyer le signalement'}</button></form> : <div className="space-y-1">
        <button type="button" onClick={() => { onClose(); onProfile(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-500/10 text-sm"><UserRound className="w-4 h-4 text-purple-500" />{group ? 'Paramètres du club' : `Voir le profil de ${name}`}</button>
        <button type="button" onClick={() => { onClose(); onBackground(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-500/10 text-sm"><Image className="w-4 h-4 text-purple-500" />Fond de la discussion</button>
        {!group && userId && <>
          <button type="button" disabled={busy} onClick={() => { if (blocked || window.confirm(`Bloquer ${name} ? Vous ne pourrez plus échanger de messages.`)) void run(onBlock); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-500/10 text-sm disabled:opacity-50"><Lock className="w-4 h-4 text-purple-500" />{blocked ? 'Débloquer cette personne' : 'Bloquer cette personne'}</button>
          <button type="button" onClick={() => setReporting(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-500/10 text-sm"><ShieldAlert className="w-4 h-4 text-purple-500" />Signaler cette personne</button>
        </>}
        {!group && <button type="button" id="delete-conversation-btn" disabled={busy} onClick={() => { if (window.confirm(`Supprimer la conversation avec ${name} ? Les messages seront effacés pour les deux participants.`)) void run(onDelete); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-500/10 text-sm text-rose-500 disabled:opacity-50"><Trash2 className="w-4 h-4" />Supprimer la conversation</button>}
      </div>}
    </section>
  </div>, document.body);
}
