/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gestion complete d'un groupe (style WhatsApp) : infos, parametres, lien
 * d'invitation, demandes d'adhesion, roles, membres, bannis, exclus.
 * Le composant appelle directement l'API ; l'etat se rafraichit via les events
 * socket (group_updated) gere dans App, qui re-fournit le `group` a jour.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, Camera, Pencil, Check, X, Link2, RotateCcw, Power, Copy,
  UserPlus, Crown, Shield, ShieldCheck, User as UserIcon, Trash2, Ban, LogOut,
  MoreVertical, MessageCircle, Megaphone, Globe, Lock, EyeOff, Users, Clock, Loader2,
} from 'lucide-react';
import { User, ReadingGroup, GroupMembership, GroupRole } from '../types';
import { authHeaders } from '../utils/auth';
import { uploadImageToCloudinary } from '../utils/uploadImage';
import { appBaseUrl } from '../utils/share';
import { VerifiedBadge } from './VerifiedBadge';
import { optimizedImage } from '../utils/imageUrl';

interface GroupSettingsViewProps {
  group: ReadingGroup;
  currentUser: User;
  allUsers: User[];
  onClose: () => void;
  onOpenDiscussion?: (userId: string) => void;
  onLeftOrDeleted?: () => void;
}

const ROLE_RANK: Record<GroupRole, number> = { owner: 3, admin: 2, moderator: 1, member: 0 };
const ROLE_LABEL: Record<GroupRole, string> = { owner: 'Propriétaire', admin: 'Administrateur', moderator: 'Modérateur', member: 'Membre' };

function RoleIcon({ role, className }: { role: GroupRole; className?: string }) {
  if (role === 'owner') return <Crown className={className} />;
  if (role === 'admin') return <ShieldCheck className={className} />;
  if (role === 'moderator') return <Shield className={className} />;
  return <UserIcon className={className} />;
}

export default function GroupSettingsView({ group, currentUser, allUsers, onClose, onOpenDiscussion, onLeftOrDeleted }: GroupSettingsViewProps) {
  const roster: GroupMembership[] = group.roster || [];
  const myMembership = roster.find((m) => m.userId === currentUser.id);
  const myRole: GroupRole = group.creatorId === currentUser.id ? 'owner' : (myMembership?.role || 'member');
  const myRank = ROLE_RANK[myRole];
  const isAdminPlus = myRank >= ROLE_RANK.admin;
  const isModPlus = myRank >= ROLE_RANK.moderator;
  const isOwner = myRole === 'owner';
  const canEditInfo = group.whoCanEditInfo === 'all' || isAdminPlus;

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  // Edition des infos.
  const [editingInfo, setEditingInfo] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  useEffect(() => { setName(group.name); setDescription(group.description || ''); }, [group.id]);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Invitation.
  const [invite, setInvite] = useState<{ code: string; enabled: boolean } | null>(null);

  // Action sur un membre (feuille du bas) + confirmation.
  const [memberSheet, setMemberSheet] = useState<GroupMembership | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onYes: () => void } | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const api = async (path: string, method: string, body?: any): Promise<any> => {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method,
        headers: authHeaders(body ? { 'Content-Type': 'application/json' } : undefined),
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 204) return {};
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.error || 'Action impossible.'); return null; }
      return data;
    } catch {
      showToast('Erreur réseau.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  // ---- Infos -------------------------------------------------------------
  const saveInfo = async () => {
    if (!name.trim()) { showToast('Le nom ne peut pas être vide.'); return; }
    const r = await api(`/api/groups/${group.id}`, 'PUT', { name: name.trim(), description });
    if (r) { setEditingInfo(false); showToast('Infos mises à jour.'); }
  };
  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Veuillez choisir une image.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image trop lourde (5 Mo max).'); return; }
    setBusy(true);
    try {
      const url = await uploadImageToCloudinary(file);
      await api(`/api/groups/${group.id}`, 'PUT', { avatar: url });
      showToast('Photo mise à jour.');
    } catch (err: any) {
      showToast(err?.message || "Échec de l'envoi de l'image.");
    } finally { setBusy(false); }
  };

  // ---- Parametres --------------------------------------------------------
  const patchSettings = async (patch: Partial<ReadingGroup>) => { await api(`/api/groups/${group.id}`, 'PUT', patch); };

  // ---- Invitation --------------------------------------------------------
  useEffect(() => {
    if (!isAdminPlus) return;
    (async () => {
      const r = await api(`/api/groups/${group.id}/invite`, 'GET');
      if (r?.code) setInvite({ code: r.code, enabled: r.enabled });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);
  const inviteLink = invite ? `${appBaseUrl()}/?joingroup=${invite.code}` : '';
  const copyInvite = () => { if (inviteLink) { navigator.clipboard?.writeText(inviteLink).catch(() => {}); showToast('Lien copié.'); } };
  const resetInvite = async () => { const r = await api(`/api/groups/${group.id}/invite/reset`, 'POST'); if (r?.code) { setInvite({ code: r.code, enabled: invite?.enabled ?? true }); showToast('Nouveau lien généré.'); } };
  const toggleInvite = async () => { const next = !(invite?.enabled ?? true); const r = await api(`/api/groups/${group.id}/invite/toggle`, 'POST', { enabled: next }); if (r) setInvite((p) => p ? { ...p, enabled: next } : p); };

  // ---- Membres -----------------------------------------------------------
  const setRole = async (userId: string, role: GroupRole) => { const r = await api(`/api/groups/${group.id}/members/${userId}/role`, 'POST', { role }); if (r) { showToast('Rôle mis à jour.'); setMemberSheet(null); } };
  const removeMember = async (userId: string) => { const r = await api(`/api/groups/${group.id}/members/${userId}`, 'DELETE'); if (r) { showToast('Membre retiré.'); setMemberSheet(null); } };
  const banMember = async (userId: string) => { const r = await api(`/api/groups/${group.id}/members/${userId}/ban`, 'POST'); if (r) { showToast('Membre banni.'); setMemberSheet(null); } };
  const unbanMember = async (userId: string) => { await api(`/api/groups/${group.id}/members/${userId}/unban`, 'POST'); showToast('Bannissement levé.'); };
  const approve = async (userId: string) => { await api(`/api/groups/${group.id}/requests/${userId}/approve`, 'POST'); showToast('Demande approuvée.'); };
  const reject = async (userId: string) => { await api(`/api/groups/${group.id}/requests/${userId}/reject`, 'POST'); showToast('Demande refusée.'); };
  const addMembers = async (ids: string[]) => { if (!ids.length) return; await api(`/api/groups/${group.id}/members`, 'POST', { memberIds: ids }); showToast('Membre(s) ajouté(s).'); setShowAddMembers(false); };

  const leaveGroup = async () => { const r = await api(`/api/groups/${group.id}/members/${currentUser.id}`, 'DELETE'); if (r) { onLeftOrDeleted?.(); onClose(); } };
  const deleteGroup = async () => { const r = await api(`/api/groups/${group.id}`, 'DELETE'); if (r) { onLeftOrDeleted?.(); onClose(); } };

  // ---- Roster trie -------------------------------------------------------
  const active = roster.filter((m) => m.status === 'active');
  const admins = active.filter((m) => ROLE_RANK[m.role] >= ROLE_RANK.moderator).sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);
  const plainMembers = active.filter((m) => m.role === 'member').sort((a, b) => a.username.localeCompare(b.username));
  const pending = roster.filter((m) => m.status === 'pending');
  const banned = roster.filter((m) => m.status === 'banned');
  const removed = roster.filter((m) => m.status === 'removed');

  // Membres non encore dans le groupe (pour l'ajout direct).
  const activeIds = new Set(active.map((m) => m.userId));
  const addableUsers = allUsers.filter((u) => u.id !== currentUser.id && !activeIds.has(u.id));

  const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  const canActOn = (m: GroupMembership): boolean => {
    if (m.userId === currentUser.id) return false;
    if (m.userId === group.creatorId) return false;
    if (!isModPlus) return false;
    if (isOwner) return true;
    return myRank > ROLE_RANK[m.role];
  };

  const MemberRow = ({ m }: { m: GroupMembership }) => (
    <button
      onClick={() => { if (canActOn(m) || m.userId === currentUser.id) setMemberSheet(m); }}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-900/40 transition text-left"
    >
      <img src={m.avatar ? optimizedImage(m.avatar, 80) : ''} alt={m.username} className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-zinc-800 shrink-0" referrerPolicy="no-referrer" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{m.username}{m.userId === currentUser.id ? ' (vous)' : ''}</span>
          {m.isVerified && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
        </div>
        <span className="text-[11px] text-gray-400">Entré le {fmtDate(m.joinedAt)}</span>
      </div>
      {m.role !== 'member' && (
        <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
          m.role === 'owner' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : m.role === 'admin' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
          : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
        }`}>
          <RoleIcon role={m.role} className="w-3 h-3" />
          {ROLE_LABEL[m.role]}
        </span>
      )}
      {(canActOn(m) || m.userId === currentUser.id) && <MoreVertical className="w-4 h-4 text-gray-400 shrink-0" />}
    </button>
  );

  const SectionTitle = ({ icon, children, count }: { icon: React.ReactNode; children: React.ReactNode; count?: number }) => (
    <div className="flex items-center gap-2 px-4 pt-4 pb-1.5">
      <span className="text-purple-600 dark:text-purple-400">{icon}</span>
      <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{children}</span>
      {count !== undefined && <span className="text-[11px] font-bold text-gray-400">· {count}</span>}
    </div>
  );

  const Toggle = ({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <button
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full transition relative shrink-0 ${on ? 'bg-purple-600' : 'bg-gray-300 dark:bg-zinc-700'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );

  const visibilityMeta: Record<string, { icon: React.ReactNode; label: string }> = {
    public: { icon: <Globe className="w-3.5 h-3.5" />, label: 'Public' },
    private: { icon: <Lock className="w-3.5 h-3.5" />, label: 'Privé' },
    invite: { icon: <Link2 className="w-3.5 h-3.5" />, label: 'Sur invitation' },
  };
  const vis = visibilityMeta[group.visibility || 'private'];

  return createPortal(
    <div className="fixed inset-0 z-[2147483000] bg-white dark:bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* En-tete */}
      <div className="shrink-0 h-14 flex items-center gap-2 px-3 border-b border-gray-100 dark:border-zinc-900">
        <button onClick={onClose} className="p-1.5 -ml-1 text-gray-600 dark:text-gray-300" aria-label="Retour"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-base font-serif font-black text-gray-900 dark:text-white flex-1 truncate">Paramètres du groupe</h1>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Bandeau identite */}
        <div className="flex flex-col items-center text-center px-4 pt-6 pb-4">
          <div className="relative">
            <img src={group.avatar ? optimizedImage(group.avatar, 200) : ''} alt={group.name} className="w-24 h-24 rounded-full object-cover bg-gradient-to-br from-purple-500 to-fuchsia-500 shrink-0" referrerPolicy="no-referrer" />
            {canEditInfo && (
              <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-black" aria-label="Changer la photo">
                <Camera className="w-4 h-4" />
              </button>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarPick} />
          </div>

          {editingInfo ? (
            <div className="w-full max-w-sm mt-3 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="w-full text-center text-lg font-serif font-black bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2" placeholder="Nom du groupe" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} className="w-full text-sm bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 resize-none" placeholder="Description du groupe" />
              <div className="flex gap-2">
                <button onClick={() => { setEditingInfo(false); setName(group.name); setDescription(group.description || ''); }} className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-zinc-850 text-gray-600 dark:text-gray-300 text-xs font-black uppercase">Annuler</button>
                <button onClick={saveInfo} className="flex-1 py-2 rounded-xl bg-purple-600 text-white text-xs font-black uppercase flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Enregistrer</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mt-3">
                <h2 className="text-xl font-serif font-black text-gray-900 dark:text-white">{group.name}</h2>
                {canEditInfo && <button onClick={() => setEditingInfo(true)} className="text-gray-400 hover:text-purple-600"><Pencil className="w-4 h-4" /></button>}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{active.length} membre{active.length > 1 ? 's' : ''}</p>
              {group.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-sm whitespace-pre-wrap">{group.description}</p>}
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 dark:bg-zinc-900 px-2.5 py-1 rounded-full">{vis.icon}{vis.label}</span>
            </>
          )}
        </div>

        {/* Parametres (admin+) */}
        {isAdminPlus && (
          <>
            <SectionTitle icon={<Shield className="w-4 h-4" />}>Paramètres</SectionTitle>
            <div className="px-4 space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Visibilité</span>
                <select value={group.visibility || 'private'} onChange={(e) => patchSettings({ visibility: e.target.value as any })} className="mt-1 w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm">
                  <option value="public">Public — visible et ouvert</option>
                  <option value="private">Privé — sur ajout d'un admin</option>
                  <option value="invite">Sur invitation uniquement</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Qui peut modifier les infos</span>
                <select value={group.whoCanEditInfo || 'admins'} onChange={(e) => patchSettings({ whoCanEditInfo: e.target.value as any })} className="mt-1 w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm">
                  <option value="admins">Administrateurs uniquement</option>
                  <option value="all">Tout le monde</option>
                </select>
              </label>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0"><div className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white"><Megaphone className="w-4 h-4 text-purple-500" />Mode annonce</div><p className="text-[11px] text-gray-400">Seuls les admins peuvent écrire.</p></div>
                <Toggle on={group.messagePermission === 'admins'} onChange={(v) => patchSettings({ messagePermission: v ? 'admins' : 'all' })} />
              </div>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0"><div className="text-sm font-bold text-gray-900 dark:text-white">Autoriser les réactions</div></div>
                <Toggle on={group.allowReactions !== false} onChange={(v) => patchSettings({ allowReactions: v })} />
              </div>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0"><div className="text-sm font-bold text-gray-900 dark:text-white">Autoriser le partage de médias</div></div>
                <Toggle on={group.allowMedia !== false} onChange={(v) => patchSettings({ allowMedia: v })} />
              </div>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0"><div className="text-sm font-bold text-gray-900 dark:text-white">Approbation manuelle</div><p className="text-[11px] text-gray-400">Valider chaque demande d'adhésion.</p></div>
                <Toggle on={!!group.requireApproval} onChange={(v) => patchSettings({ requireApproval: v })} />
              </div>
            </div>

            {/* Invitation */}
            <SectionTitle icon={<Link2 className="w-4 h-4" />}>Lien d'invitation</SectionTitle>
            <div className="px-4 space-y-2">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2">
                <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-600 dark:text-gray-300 font-mono truncate flex-1">{invite?.enabled ? (inviteLink || '...') : 'Lien désactivé'}</span>
                <button onClick={copyInvite} disabled={!invite?.enabled} className="text-purple-600 disabled:opacity-40" aria-label="Copier"><Copy className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2">
                <button onClick={resetInvite} className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-zinc-850 text-gray-700 dark:text-gray-200 text-[11px] font-black uppercase flex items-center justify-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Réinitialiser</button>
                <button onClick={toggleInvite} className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-1.5 ${invite?.enabled ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}><Power className="w-3.5 h-3.5" /> {invite?.enabled ? 'Désactiver' : 'Activer'}</button>
              </div>
            </div>
          </>
        )}

        {/* Demandes en attente (admin+) */}
        {isAdminPlus && pending.length > 0 && (
          <>
            <SectionTitle icon={<Clock className="w-4 h-4" />} count={pending.length}>Demandes en attente</SectionTitle>
            {pending.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5">
                <img src={m.avatar ? optimizedImage(m.avatar, 80) : ''} alt={m.username} className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-zinc-800 shrink-0" referrerPolicy="no-referrer" />
                <span className="flex-1 min-w-0 text-sm font-bold text-gray-900 dark:text-white truncate">{m.username}</span>
                <button onClick={() => reject(m.userId)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-850 text-gray-500 text-[11px] font-black uppercase">Refuser</button>
                <button onClick={() => approve(m.userId)} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-black uppercase">Approuver</button>
              </div>
            ))}
          </>
        )}

        {/* Administrateurs */}
        <SectionTitle icon={<ShieldCheck className="w-4 h-4" />} count={admins.length}>Administration</SectionTitle>
        {admins.map((m) => <MemberRow key={m.userId} m={m} />)}

        {/* Membres */}
        <div className="flex items-center justify-between pr-3">
          <SectionTitle icon={<Users className="w-4 h-4" />} count={plainMembers.length}>Membres</SectionTitle>
          {isAdminPlus && addableUsers.length > 0 && (
            <button onClick={() => setShowAddMembers(true)} className="flex items-center gap-1 text-purple-600 dark:text-purple-400 text-[11px] font-black uppercase"><UserPlus className="w-4 h-4" /> Ajouter</button>
          )}
        </div>
        {plainMembers.map((m) => <MemberRow key={m.userId} m={m} />)}
        {plainMembers.length === 0 && <p className="px-4 py-2 text-xs text-gray-400">Aucun membre simple.</p>}

        {/* Bannis / Exclus (admin+) */}
        {isAdminPlus && banned.length > 0 && (
          <>
            <SectionTitle icon={<Ban className="w-4 h-4" />} count={banned.length}>Membres bannis</SectionTitle>
            {banned.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5">
                <img src={m.avatar ? optimizedImage(m.avatar, 80) : ''} alt={m.username} className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-zinc-800 shrink-0 grayscale" referrerPolicy="no-referrer" />
                <span className="flex-1 min-w-0 text-sm font-bold text-gray-500 truncate">{m.username}</span>
                <button onClick={() => unbanMember(m.userId)} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-850 text-purple-600 text-[11px] font-black uppercase">Débannir</button>
              </div>
            ))}
          </>
        )}
        {isAdminPlus && removed.length > 0 && (
          <>
            <SectionTitle icon={<LogOut className="w-4 h-4" />} count={removed.length}>Récemment exclus / partis</SectionTitle>
            {removed.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5 opacity-70">
                <img src={m.avatar ? optimizedImage(m.avatar, 80) : ''} alt={m.username} className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-zinc-800 shrink-0" referrerPolicy="no-referrer" />
                <span className="flex-1 min-w-0 text-sm font-bold text-gray-500 truncate">{m.username}</span>
                {isAdminPlus && <button onClick={() => addMembers([m.userId])} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-850 text-purple-600 text-[11px] font-black uppercase">Ré-ajouter</button>}
              </div>
            ))}
          </>
        )}

        {/* Zone dangereuse */}
        <div className="px-4 pt-6 pb-4">
          {isOwner ? (
            <button onClick={() => setConfirm({ title: 'Supprimer le groupe', message: 'Le groupe, ses messages et ses membres seront définitivement supprimés. Cette action est irréversible.', danger: true, onYes: deleteGroup })} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-black uppercase tracking-wide"><Trash2 className="w-4 h-4" /> Supprimer le groupe</button>
          ) : (
            <button onClick={() => setConfirm({ title: 'Quitter le groupe', message: 'Vous ne recevrez plus les messages de ce groupe.', danger: true, onYes: leaveGroup })} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-black uppercase tracking-wide"><LogOut className="w-4 h-4" /> Quitter le groupe</button>
          )}
        </div>
      </div>

      {/* Feuille d'action sur un membre */}
      {memberSheet && (
        <div className="fixed inset-0 z-[10] bg-black/50 flex items-end" onClick={() => setMemberSheet(null)}>
          <div className="w-full bg-white dark:bg-[#0E0E14] rounded-t-3xl p-4 animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3 pb-3 mb-2 border-b border-gray-100 dark:border-zinc-800">
              <img src={memberSheet.avatar ? optimizedImage(memberSheet.avatar, 80) : ''} alt="" className="w-11 h-11 rounded-full object-cover bg-gray-200 dark:bg-zinc-800" referrerPolicy="no-referrer" />
              <div className="min-w-0">
                <div className="text-sm font-black text-gray-900 dark:text-white truncate">{memberSheet.username}</div>
                <div className="text-[11px] text-gray-400">{ROLE_LABEL[memberSheet.role]}</div>
              </div>
            </div>
            {(() => {
              const m = memberSheet;
              const items: React.ReactNode[] = [];
              if (onOpenDiscussion && m.userId !== currentUser.id) {
                items.push(<SheetItem key="msg" icon={<MessageCircle className="w-4 h-4" />} label="Envoyer un message" onClick={() => { setMemberSheet(null); onOpenDiscussion(m.userId); }} />);
              }
              if (m.userId === currentUser.id) {
                // Pas d'action sur soi-meme ici (Quitter est en bas).
              } else if (canActOn(m)) {
                // Promotions / retrogradations.
                if (isOwner && m.role !== 'admin') items.push(<SheetItem key="mkadmin" icon={<ShieldCheck className="w-4 h-4" />} label="Nommer administrateur" onClick={() => setRole(m.userId, 'admin')} />);
                if (isOwner && m.role === 'admin') items.push(<SheetItem key="rmadmin" icon={<Shield className="w-4 h-4" />} label="Retirer administrateur" onClick={() => setConfirm({ title: 'Retirer administrateur', message: `Retirer les droits d'administrateur de ${m.username} ?`, onYes: () => setRole(m.userId, 'member') })} />);
                if (m.role !== 'moderator' && m.role !== 'admin') items.push(<SheetItem key="mkmod" icon={<Shield className="w-4 h-4" />} label="Nommer modérateur" onClick={() => setRole(m.userId, 'moderator')} />);
                if (m.role === 'moderator') items.push(<SheetItem key="rmmod" icon={<UserIcon className="w-4 h-4" />} label="Retirer modérateur" onClick={() => setRole(m.userId, 'member')} />);
                if (isOwner) items.push(<SheetItem key="transfer" icon={<Crown className="w-4 h-4" />} label="Transférer la propriété" onClick={() => setConfirm({ title: 'Transférer la propriété', message: `${m.username} deviendra propriétaire et vous deviendrez administrateur. Continuer ?`, danger: true, onYes: () => setRole(m.userId, 'owner') })} />);
                items.push(<SheetItem key="remove" icon={<Trash2 className="w-4 h-4" />} label="Exclure du groupe" danger onClick={() => setConfirm({ title: 'Exclure ce membre', message: `Exclure ${m.username} du groupe ?`, danger: true, onYes: () => removeMember(m.userId) })} />);
                items.push(<SheetItem key="ban" icon={<Ban className="w-4 h-4" />} label="Bannir" danger onClick={() => setConfirm({ title: 'Bannir ce membre', message: `${m.username} ne pourra plus rejoindre le groupe via un lien. Continuer ?`, danger: true, onYes: () => banMember(m.userId) })} />);
              }
              return <div className="space-y-0.5">{items.length ? items : <p className="text-xs text-gray-400 py-2 text-center">Aucune action disponible.</p>}</div>;
            })()}
          </div>
        </div>
      )}

      {/* Ajout de membres */}
      {showAddMembers && (
        <AddMembersSheet users={addableUsers} onCancel={() => setShowAddMembers(false)} onConfirm={addMembers} />
      )}

      {/* Confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-[20] bg-black/60 flex items-center justify-center p-5" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-[#0E0E14] rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-serif font-black text-gray-900 dark:text-white">{confirm.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{confirm.message}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-850 text-gray-600 dark:text-gray-300 text-xs font-black uppercase">Annuler</button>
              <button onClick={() => { const fn = confirm.onYes; setConfirm(null); fn(); }} className={`flex-1 py-2.5 rounded-xl text-white text-xs font-black uppercase ${confirm.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}>Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[30] bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-bold px-4 py-2.5 rounded-full shadow-xl" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>{toast}</div>
      )}
    </div>,
    document.body,
  );
}

function SheetItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900 transition text-left ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
      <span className="shrink-0">{icon}</span>
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function AddMembersSheet({ users, onCancel, onConfirm }: { users: User[]; onCancel: () => void; onConfirm: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const filtered = users.filter((u) => u.username.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="fixed inset-0 z-[15] bg-black/50 flex items-end" onClick={onCancel}>
      <div className="w-full bg-white dark:bg-[#0E0E14] rounded-t-3xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
        <div className="p-4 pb-2 shrink-0">
          <h3 className="text-base font-serif font-black text-gray-900 dark:text-white mb-2">Ajouter des membres</h3>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher..." className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {filtered.map((u) => (
            <button key={u.id} onClick={() => toggle(u.id)} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900 text-left">
              <img src={u.avatar ? optimizedImage(u.avatar, 80) : ''} alt={u.username} className="w-9 h-9 rounded-full object-cover bg-gray-200 dark:bg-zinc-800 shrink-0" referrerPolicy="no-referrer" />
              <span className="flex-1 text-sm font-bold text-gray-900 dark:text-white truncate">{u.username}</span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected.has(u.id) ? 'bg-purple-600 border-purple-600' : 'border-gray-300 dark:border-zinc-700'}`}>{selected.has(u.id) && <Check className="w-3 h-3 text-white" />}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-6">Aucun utilisateur.</p>}
        </div>
        <div className="p-3 flex gap-2 shrink-0 border-t border-gray-100 dark:border-zinc-800">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-850 text-gray-600 dark:text-gray-300 text-xs font-black uppercase">Annuler</button>
          <button onClick={() => onConfirm(Array.from(selected))} disabled={!selected.size} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black uppercase disabled:opacity-40">Ajouter ({selected.size})</button>
        </div>
      </div>
    </div>
  );
}
