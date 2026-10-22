import { useEffect, useState } from 'react';
import { BookOpen, CheckCheck, ChevronRight, Compass, Feather, Loader2, MessageSquare, PencilLine, Pin, PinOff, Plus, Search, Users, X } from 'lucide-react';
import type { Conversation, ReadingGroup, User } from '../types';
import { authHeaders } from '../utils/auth';
import { formatInboxDate, inboxTimestamp, isIncomingRequest, lastVisibleMessage, messagePreview, normalizeInboxSearch, selectInboxConversations, unreadMessages, type InboxFilter } from '../utils/inbox';
import { VerifiedBadge } from './VerifiedBadge';

type Props = {
  user: User; users: User[]; conversations: Conversation[]; groups: ReadingGroup[];
  activeTab: 'chats' | 'groups'; onChangeTab: (tab: 'chats' | 'groups') => void;
  activeConversationId: string; activeGroupId: string | null;
  hiddenMessages: ReadonlySet<string>; onlineIds: Set<string>; typingIds?: Set<string>;
  groupTyping?: Record<string, string>;
  onSelectConversation: (id: string) => void; onSelectGroup: (id: string) => void;
  onViewProfile?: (id: string) => void; onNewChat: () => void; onNewGroup: () => void; onDiscover: () => void;
  onPinSaved: (id: string, isPinned: boolean, pinnedAt: string | null) => void;
  mentionsMe: (groupId: string, unread: number) => boolean;
};

function Avatar({ name, src, className = 'h-12 w-12' }: { name: string; src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span role="img" aria-label={`Avatar de ${name}`} className={`relative shrink-0 flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-400 to-purple-800 text-white ring-1 ring-purple-500/20 ${className}`}>
    <span aria-hidden="true" className="font-serif text-lg font-bold">{name.slice(0, 1).toUpperCase()}</span>
    {src && !failed && <img src={src} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />}
  </span>;
}

function Badge({ count, label }: { count: number; label: string }) {
  return count > 0 ? <span aria-label={`${count} ${label}`} className="inline-flex min-w-5 h-5 px-1.5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-semibold shadow-sm shadow-purple-500/20">{count > 99 ? '99+' : count}</span> : null;
}

export default function MessagesInbox(props: Props) {
  const { user, users, conversations, groups, activeTab, onChangeTab, activeConversationId, activeGroupId, hiddenMessages, onlineIds, typingIds, groupTyping, onSelectConversation, onSelectGroup, onViewProfile, onNewChat, onNewGroup, onDiscover, onPinSaved, mentionsMe } = props;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [pinBusy, setPinBusy] = useState<Set<string>>(new Set());
  const [pinError, setPinError] = useState('');
  const all = selectInboxConversations(conversations, user.id, { activeId: activeConversationId });
  const filtered = selectInboxConversations(conversations, user.id, { query, filter, hidden: hiddenMessages, activeId: activeConversationId });
  const requests = all.filter(conversation => isIncomingRequest(conversation, user.id)).length;
  const unread = activeTab === 'chats' ? all.reduce((sum, conversation) => sum + unreadMessages(conversation), 0) : groups.reduce((sum, group) => sum + unreadMessages(group), 0);
  const pinned = filtered.filter(conversation => conversation.isPinned), regular = filtered.filter(conversation => !conversation.isPinned);
  const search = normalizeInboxSearch(query);
  const filteredGroups = groups.filter(group => (!search || normalizeInboxSearch(`${group.name} ${group.description}`).includes(search)) && (filter !== 'unread' || unreadMessages(group) > 0))
    .sort((a, b) => inboxTimestamp(b.lastMessageDate) - inboxTimestamp(a.lastMessageDate));
  const pinConversation = async (conversation: Conversation) => {
    if (pinBusy.has(conversation.id)) return;
    setPinBusy(previous => new Set(previous).add(conversation.id)); setPinError('');
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(conversation.id)}/pin`, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ pinned: !conversation.isPinned }) });
      if (!response.ok) throw new Error('Save failed');
      const saved = await response.json(); onPinSaved(conversation.id, saved.isPinned, saved.pinnedAt);
    } catch { setPinError('L’épinglage n’a pas pu être enregistré. Vérifiez votre connexion et réessayez.'); }
    finally { setPinBusy(previous => { const next = new Set(previous); next.delete(conversation.id); return next; }); }
  };
  const renderConversation = (conversation: Conversation) => {
    const participant = conversation.participants.find(partner => partner.id !== user.id);
    const partner = participant?.username ? participant : users.find(other => other.id === participant?.id);
    const name = partner?.username || 'Compte supprimé';
    const last = lastVisibleMessage(conversation, hiddenMessages);
    const incoming = isIncomingRequest(conversation, user.id);
    const active = conversation.id === activeConversationId && !activeGroupId;
    return <article key={conversation.id} data-conversation-id={conversation.id} className={`group flex items-center gap-2 sm:gap-3 px-3 py-3 transition-colors ${active ? 'bg-purple-500/10' : 'hover:bg-purple-500/5'}`}>
      <button type="button" aria-label={`Voir le profil de ${name}`} disabled={!partner} onClick={() => partner && onViewProfile?.(partner.id)} className="relative shrink-0 rounded-full">
        <Avatar key={partner?.avatar || name} name={name} src={partner?.avatar} />
        {partner && onlineIds.has(partner.id) && <span aria-label="En ligne" className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#181b2c] bg-emerald-500" />}
      </button>
      <button type="button" id={`chat-partner-select-${partner?.id || conversation.id}`} aria-label={`Ouvrir la discussion avec ${name}`} onClick={() => onSelectConversation(conversation.id)} className="flex-1 min-w-0 text-left py-0.5">
        <span className="flex items-center gap-1.5"><span className="truncate font-semibold text-sm text-zinc-900 dark:text-zinc-100">{name}</span>{partner?.isVerified && <VerifiedBadge size="xs" />}</span>
        <span className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 min-w-0">
          {partner && typingIds?.has(partner.id) ? <><Feather className="w-3.5 h-3.5 text-purple-500 animate-feather-write shrink-0" /><span className="text-purple-600 dark:text-purple-300 italic">écrit…</span></> : <>
            {last?.senderId === user.id && !last.deletedForEveryone && <CheckCheck className={`w-3.5 h-3.5 shrink-0 ${last.isRead ? 'text-purple-500' : 'text-zinc-400'}`} />}
            <span className="truncate">{last?.senderId === user.id && !last.deletedForEveryone ? 'Vous : ' : ''}{messagePreview(last)}</span>
          </>}
        </span>
        {conversation.requestStatus === 'PENDING' && <span className="mt-1 block text-[10px] text-purple-600 dark:text-purple-300">{incoming ? 'Demande reçue' : 'Demande envoyée'}</span>}
      </button>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <time dateTime={last?.createdAt || last?.date} className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{formatInboxDate(last?.createdAt || last?.date)}</time>
        <div className="flex items-center gap-1.5">
          <Badge count={unreadMessages(conversation)} label="messages non lus" />
          <button type="button" aria-label={`${conversation.isPinned ? 'Désépingler' : 'Épingler'} la discussion avec ${name}`} aria-pressed={!!conversation.isPinned} disabled={pinBusy.has(conversation.id)} onClick={() => void pinConversation(conversation)} className={`p-1.5 rounded-lg hover:bg-purple-500/15 disabled:opacity-50 ${conversation.isPinned ? 'text-purple-600 dark:text-purple-300' : 'text-zinc-400'}`}>
            {pinBusy.has(conversation.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : conversation.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </article>;
  };
  const changeTab = (tab: 'chats' | 'groups') => { setQuery(''); setFilter('all'); setPinError(''); onChangeTab(tab); };
  return <section aria-label="Boîte de réception" className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#0e1120]">
    <header className="px-4 pt-4 pb-3 flex items-center gap-3">
      <div className="flex-1 min-w-0"><h1 className="font-serif font-bold text-[34px] md:text-3xl leading-tight tracking-tight text-zinc-950 dark:text-white">Messages</h1><p className="font-serif text-sm text-zinc-500 dark:text-purple-200/65 mt-0.5">Les histoires créent des liens.</p></div>
      <button type="button" onClick={onNewChat} aria-label="Démarrer une discussion" className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg shadow-purple-600/20 flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition"><PencilLine className="w-6 h-6" /></button>
    </header>
    <div className="mx-4 my-2 flex items-center gap-2 px-3 py-3 rounded-2xl border border-zinc-200 dark:border-purple-300/10 bg-zinc-100/80 dark:bg-white/[0.04] focus-within:ring-2 focus-within:ring-purple-500/40">
      <Search className="w-4 h-4 text-zinc-500 dark:text-purple-300/65 shrink-0" />
      <input id="whatsapp-search-input" type="search" aria-label={activeTab === 'chats' ? 'Rechercher une conversation' : 'Rechercher un club de lecture'} placeholder={activeTab === 'chats' ? 'Rechercher une conversation…' : 'Rechercher un club de lecture…'} value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 w-full text-xs outline-none bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" />
      {query && <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} className="text-zinc-400"><X className="w-4 h-4" /></button>}
    </div>
    <div role="tablist" aria-label="Discussions et clubs" className="mx-4 mt-2 p-1 grid grid-cols-2 gap-1 rounded-2xl border border-zinc-200 dark:border-purple-300/10 bg-zinc-50 dark:bg-white/[0.025]">
      {(['chats', 'groups'] as const).map(tab => <button type="button" role="tab" key={tab} aria-selected={activeTab === tab} onClick={() => changeTab(tab)} className={`flex items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-xs transition ${activeTab === tab ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md shadow-purple-600/15' : 'text-zinc-500 dark:text-purple-200/70 hover:bg-purple-500/10'}`}>
        {tab === 'chats' ? <MessageSquare className="h-4 w-4 shrink-0" /> : <Users className="h-4 w-4 shrink-0" />}<span>{tab === 'chats' ? 'Discussions' : `Clubs de lecture (${groups.length})`}</span>
      </button>)}
    </div>
    <div role="group" aria-label="Filtrer les échanges" className="flex flex-wrap gap-2 px-4 py-3">
      {(['all', 'unread', ...(activeTab === 'chats' ? ['requests'] : [])] as InboxFilter[]).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full border text-xs transition ${filter === value ? 'border-purple-400 bg-purple-500/15 text-purple-800 dark:text-purple-100 shadow-sm shadow-purple-500/15' : 'border-zinc-200 dark:border-purple-300/10 text-zinc-500 dark:text-purple-200/65 hover:bg-purple-500/5'}`}>
        {value === 'all' ? 'Tous' : value === 'unread' ? 'Non lus' : 'Demandes'}{value !== 'all' && <Badge count={value === 'unread' ? unread : requests} label={value === 'unread' ? 'messages non lus' : 'demandes reçues'} />}
      </button>)}
    </div>
    {pinError && <p role="alert" className="mx-4 mb-2 text-xs text-rose-600 dark:text-rose-300">{pinError}</p>}
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 pb-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
      {activeTab === 'chats' ? <>
        {!!pinned.length && <section aria-label="Discussions épinglées"><h2 className="flex items-center gap-2 text-sm font-serif text-zinc-700 dark:text-purple-200/80 mb-2"><Pin className="w-4 h-4 text-purple-500" />Épinglés</h2><div className="rounded-2xl border border-purple-500/15 bg-purple-50/50 dark:bg-white/[0.035] divide-y divide-purple-500/10 overflow-hidden">{pinned.map(renderConversation)}</div></section>}
        {!!regular.length && <section aria-label="Liste des discussions"><h2 className="flex items-center gap-2 text-sm font-serif text-zinc-700 dark:text-purple-200/80 mb-2"><MessageSquare className="w-4 h-4 text-purple-500" />{filter === 'requests' ? 'Demandes de discussion' : filter === 'unread' ? 'Discussions non lues' : 'Toutes les discussions'}</h2><div className="rounded-2xl border border-zinc-200 dark:border-purple-300/10 bg-zinc-50/60 dark:bg-white/[0.035] divide-y divide-zinc-200/70 dark:divide-white/5 overflow-hidden">{regular.map(renderConversation)}</div></section>}
        {!filtered.length && <div role="status" className="rounded-2xl border border-dashed border-purple-500/20 text-center px-4 py-7 text-sm text-zinc-500 dark:text-zinc-400"><MessageSquare className="h-7 w-7 mx-auto mb-2 text-purple-400" />{query ? 'Aucune conversation ne correspond à votre recherche.' : filter === 'unread' ? 'Vous êtes à jour. Aucun message non lu.' : filter === 'requests' ? 'Aucune demande en attente.' : 'Les belles conversations commencent par un bonjour.'}{filter === 'all' && !query && <button type="button" onClick={onNewChat} className="block mx-auto mt-3 text-xs font-semibold text-purple-600 dark:text-purple-300">Démarrer une discussion</button>}</div>}
        {filter === 'all' && !query && !!groups.length && <section aria-label="Vos clubs de lecture" className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-100/70 to-violet-50 dark:from-purple-900/20 dark:to-purple-950/10 p-3 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-serif text-purple-900 dark:text-purple-200"><BookOpen className="w-4 h-4" />{groups.length === 1 ? 'Votre club de lecture' : 'Vos clubs de lecture'}</h2>
          {groups.slice(0, 2).map(group => <button type="button" key={group.id} aria-label={`Ouvrir le club ${group.name}`} onClick={() => onSelectGroup(group.id)} className="w-full flex items-center gap-3 text-left rounded-xl py-2 hover:bg-purple-500/10">
            <span className="flex -space-x-3 shrink-0">{group.members.slice(0, 3).map(id => { const member = users.find(other => other.id === id) || (id === user.id ? user : null); return <Avatar key={id} name={member?.username || 'Membre'} src={member?.avatar} className="w-8 h-8 border-2 border-white dark:border-[#19152b]" />; })}</span>
            <span className="flex-1 min-w-0"><span className="block font-serif font-bold text-sm text-zinc-900 dark:text-white truncate">{group.name}</span><span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{group.description || 'Une histoire, plusieurs regards.'}</span><span className="mt-2 inline-flex items-center gap-1 text-xs text-purple-700 dark:text-purple-300">Ouvrir le club <ChevronRight className="w-3 h-3" /></span></span>
            <Badge count={unreadMessages(group)} label="messages non lus dans le club" />
          </button>)}
          {groups.length > 2 && <button type="button" onClick={() => changeTab('groups')} className="text-xs text-purple-700 dark:text-purple-300">Voir tous mes clubs <ChevronRight className="w-3 h-3 inline" /></button>}
        </section>}
      </> : <>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={onNewGroup} className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-xs text-white"><Plus className="w-3.5 h-3.5" />Créer un club</button><button type="button" onClick={onDiscover} className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/25 px-3 py-2 text-xs text-purple-700 dark:text-purple-300"><Compass className="w-3.5 h-3.5" />Découvrir</button></div>
        <section aria-label="Liste des clubs" className="space-y-2">
          {filteredGroups.map(group => <button type="button" key={group.id} aria-label={`Ouvrir le club ${group.name}`} onClick={() => onSelectGroup(group.id)} className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left ${activeGroupId === group.id ? 'border-purple-500/40 bg-purple-500/10' : 'border-zinc-200 dark:border-purple-300/10 bg-zinc-50 dark:bg-white/[0.035] hover:bg-purple-500/5'}`}>
            {group.avatar ? <Avatar name={group.name} src={group.avatar} /> : <span className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-purple-500/15 text-purple-500"><BookOpen className="w-6 h-6" /></span>}
            <span className="flex-1 min-w-0"><span className="block font-serif font-bold text-sm text-zinc-900 dark:text-white truncate">{group.name}</span><span className="block truncate text-xs text-zinc-500 dark:text-zinc-400 mt-1">{groupTyping?.[group.id] ? `${groupTyping[group.id]} écrit…` : group.lastMessage ? messagePreview({content:group.lastMessage}) : group.description || 'Commencez la discussion'}</span><span className="text-[10px] text-zinc-400">{group.members.length} membres</span></span>
            <span className="flex flex-col items-end gap-1.5 shrink-0"><time className="text-[10px] text-zinc-500 dark:text-zinc-400">{formatInboxDate(group.lastMessageDate)}</time><span className="flex gap-1">{mentionsMe(group.id, unreadMessages(group)) && <span aria-label="Vous avez été mentionné" className="text-xs font-bold text-purple-500">@</span>}<Badge count={unreadMessages(group)} label="messages non lus dans le club" /></span></span>
          </button>)}
          {!filteredGroups.length && <p role="status" className="py-7 text-center text-sm text-zinc-500 dark:text-zinc-400">{query ? 'Aucun club ne correspond à votre recherche.' : filter === 'unread' ? 'Vous êtes à jour dans vos clubs.' : 'Trouvez votre prochain cercle de lecteurs.'}</p>}
        </section>
      </>}
      <div aria-hidden="true" className="pt-5 pb-2 text-center text-purple-600/60 dark:text-purple-300/50 select-none"><div className="relative w-24 h-20 mx-auto"><BookOpen className="absolute w-20 h-14 bottom-0 left-0 stroke-1" /><img src="/app-icon.png" alt="" className="absolute right-0 top-0 w-12 h-12 rounded-full opacity-80 -rotate-12" /></div><p className="font-serif text-xs mt-2">Une bonne histoire mérite d’être partagée.</p></div>
    </div>
  </section>;
}
