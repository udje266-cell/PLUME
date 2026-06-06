/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  MessageSquare, 
  Plus, 
  Search, 
  ArrowLeft,
  CheckCheck,
  MoreVertical,
  Phone,
  Smile,
  Paperclip,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Mic,
  Square,
  Users,
  PlusCircle,
  Play,
  Pause,
  X,
  Volume2,
  Trash2,
  Check,
  Headphones,
  BookOpen
} from 'lucide-react';
import { Message, User, ReadingGroup, GroupMessage, Story, Conversation } from '../types';
import { VerifiedBadge } from './VerifiedBadge';

interface MessagesViewProps {
  currentUser: User;
  allUsers: User[];
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  onSendMessage: (conversationId: string, content: string) => void;
  onSimulateReceiveMessage: (conversationId: string, senderId: string, content: string) => void;
  onStartConversation: (participantIds: string[]) => Promise<Conversation>;
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
  groups: ReadingGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ReadingGroup[]>>;
  groupMessages: GroupMessage[];
  setGroupMessages: React.Dispatch<React.SetStateAction<GroupMessage[]>>;
  stories: Story[];
  onSelectStory: (story: Story) => void;
}

// Interactive soundwave visual playback player mockup
function VoicePlayerMockup({ durationStr, isSentByMe }: { durationStr: string; isSentByMe: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<any>(null);

  useEffect(() => {
    if (isPlaying) {
      progressRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 8;
        });
      }, 350);
    } else {
      if (progressRef.current) clearInterval(progressRef.current);
    }
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isPlaying]);

  return (
    <div className="flex items-center space-x-3 py-1 px-1">
      <button 
        type="button"
        onClick={() => setIsPlaying(!isPlaying)}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 ${
          isSentByMe 
            ? 'bg-purple-900/60 text-white hover:bg-purple-900/80 border border-purple-500/10' 
            : 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-200/50'
        }`}
        title={isPlaying ? "Mettre en pause" : "Écouter la note"}
      >
        {isPlaying ? (
          <span className="flex space-x-0.75 items-center justify-center">
            <span className="w-1 h-3.5 bg-current animate-pulse"></span>
            <span className="w-1 h-3.5 bg-current animate-pulse delay-75"></span>
          </span>
         ) : (
          <Play className="w-3 h-3 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform representation */}
      <div className="flex-1 min-w-0">
        <div className="flex items-end space-x-0.5 h-6 w-28 sm:w-36 md:w-44 mb-0.5">
          {[12, 18, 8, 22, 14, 25, 10, 16, 28, 12, 20, 8, 15, 24, 18, 10, 22, 14, 26, 8, 16, 12].map((height, idx) => {
            const hasPassed = (idx / 22) * 100 <= progress;
            return (
              <span 
                key={idx} 
                className="w-0.75 rounded-t-full transition-colors duration-200"
                style={{ 
                  height: `${height}px`,
                  backgroundColor: hasPassed 
                    ? (isSentByMe ? '#ffffff' : '#7C3AED') 
                    : (isSentByMe ? 'rgba(255,255,255,0.35)' : 'rgba(156,163,175,0.3)')
                }}
              ></span>
            );
          })}
        </div>
        <div className={`text-[9px] font-mono select-none ${isSentByMe ? 'text-purple-200' : 'text-gray-400'}`}>
          {isPlaying ? `Lecture en cours...` : `Note vocale • ${durationStr}`}
        </div>
      </div>
    </div>
  );
}

export default function MessagesView({
  currentUser,
  allUsers,
  conversations,
  setConversations,
  onSendMessage,
  onSimulateReceiveMessage,
  onStartConversation,
  activeConversationId,
  setActiveConversationId,
  groups,
  setGroups,
  groupMessages,
  setGroupMessages,
  stories,
  onSelectStory
}: MessagesViewProps) {
  
  // Left panel navigation tabs
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');

  const [messageText, setMessageText] = useState('');
  const [simulationText, setSimulationText] = useState('');
  const [showSimPanel, setShowSimPanel] = useState(true);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Modals state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);

  // New Group Form States
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupStoryId, setNewGroupStoryId] = useState('');
  const [groupSelectedMembers, setGroupSelectedMembers] = useState<string[]>([]);

  // Search filter for new connection modal
  const [authorSearch, setAuthorSearch] = useState('');

  // Voice Note Recording simulation
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  // High fidelity simulated audio call state
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connected'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<any>(null);

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const interlocutor = activeConv 
    ? (activeConv.participants.find(p => p.id !== currentUser.id) || activeConv.participants[0])
    : (allUsers.find(u => u.id !== currentUser.id) || allUsers[1] || allUsers[0]);
  const activeGroup = groups.find(g => g.id === activeGroupId);

  // Auto-scroll to bottom of discussion
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, groupMessages, activeConversationId, activeGroupId]);

  // If conversation changes, open thread on mobile
  useEffect(() => {
    if (activeConversationId) {
      setMobileShowThread(true);
    }
  }, [activeConversationId]);

  // Real-time messages read endpoint trigger on conversation activation
  useEffect(() => {
    if (activeConversationId) {
      fetch('/api/messages/read', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('plume_auth_token')}`
        },
        body: JSON.stringify({ conversationId: activeConversationId })
      }).catch(e => console.error(e));

      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            unreadCount: 0,
            messages: c.messages.map(m => m.senderId !== currentUser.id ? { ...m, isRead: true } : m)
          };
        }
        return c;
      }));
    }
  }, [activeConversationId, currentUser.id, setConversations]);

  // Voice Note recording dynamic timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  // Simulated audio call timer
  useEffect(() => {
    if (callState === 'ringing') {
      // Connect call automatically after 2.5 seconds
      const connectTimeout = setTimeout(() => {
        setCallState('connected');
      }, 2500);
      return () => clearTimeout(connectTimeout);
    } else if (callState === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callState]);

  const handleStartCall = () => {
    setCallDuration(0);
    setCallState('ringing');
  };

  const handleEndCall = () => {
    setCallState('idle');
    setCallDuration(0);
  };

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Group messages for active thread (direct chat)
  const threadMessages = activeConv ? activeConv.messages : [];

  // Group messages filter (group chat)
  const activeGroupMessages = groupMessages.filter(
    m => m.groupId === activeGroupId
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Submit send message
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    if (activeGroupId) {
      // Send to group
      const newGMsg: GroupMessage = {
        id: 'gmsg_' + Date.now(),
        groupId: activeGroupId,
        senderId: currentUser.id,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatar,
        content: messageText.trim(),
        date: new Date().toISOString()
      };
      setGroupMessages(prev => [...prev, newGMsg]);

      // Update the groups last message state
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        lastMessage: messageText.trim(),
        lastMessageDate: new Date().toISOString()
      } : g));

    } else if (activeConversationId) {
      // Send personal
      onSendMessage(activeConversationId, messageText.trim());
    }
    setMessageText('');
  };

  // Start voice note simulation
  const handleStartVoiceNote = () => {
    setIsRecording(true);
  };

  // Discard voice note recording
  const handleDiscardVoiceNote = () => {
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Finalize & send vocal note
  const handleSendVoiceNote = () => {
    const finalSecs = recordingSeconds || 4;
    const mins = Math.floor(finalSecs / 60);
    const secs = finalSecs % 60;
    const finalFormattedStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    const voiceTag = `[🎙️ Note Vocale - ${finalFormattedStr}]`;

    if (activeGroupId) {
      const newGMsg: GroupMessage = {
        id: 'gmsg_' + Date.now(),
        groupId: activeGroupId,
        senderId: currentUser.id,
        senderName: currentUser.username,
        senderAvatar: currentUser.avatar,
        content: voiceTag,
        date: new Date().toISOString()
      };
      setGroupMessages(prev => [...prev, newGMsg]);
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        lastMessage: '🎙️ Note vocale',
        lastMessageDate: new Date().toISOString()
      } : g));
    } else if (activeConversationId) {
      onSendMessage(activeConversationId, voiceTag);
    }

    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Submit simulated response
  const handleSimulatedReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulationText.trim()) return;

    if (activeGroupId) {
      // Group simulated response - pick selected simulation sender or default to first group member
      const otherMembers = activeGroup
        ? allUsers.filter(u => activeGroup.members.includes(u.id) && u.id !== currentUser.id)
        : [];
      const simGroupAuthor = otherMembers[0] || allUsers[1];

      const newGMsg: GroupMessage = {
        id: 'gmsg_' + Date.now(),
        groupId: activeGroupId,
        senderId: simGroupAuthor.id,
        senderName: simGroupAuthor.username,
        senderAvatar: simGroupAuthor.avatar,
        content: simulationText.trim(),
        date: new Date().toISOString()
      };
      setGroupMessages(prev => [...prev, newGMsg]);
      setGroups(prev => prev.map(g => g.id === activeGroupId ? {
        ...g,
        lastMessage: simulationText.trim(),
        lastMessageDate: new Date().toISOString()
      } : g));

    } else if (activeConversationId && interlocutor) {
      onSimulateReceiveMessage(activeConversationId, interlocutor.id, simulationText.trim());
    }
    setSimulationText('');
  };

  // Custom formatted dynamic timing helper for recorder
  const formatRecordTime = (secondsCount: number) => {
    const mins = Math.floor(secondsCount / 60);
    const secs = secondsCount % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Create new group handler
  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGrpId = 'group_' + Date.now();
    const freshMembers = [currentUser.id, ...groupSelectedMembers];
    const newGrp: ReadingGroup = {
      id: newGrpId,
      name: newGroupName.trim(),
      description: newGroupDesc.trim() || 'Cercle de partage et de critiques narratives',
      members: freshMembers,
      lastMessage: 'Groupe de lecture créé par ' + currentUser.username,
      lastMessageDate: new Date().toISOString(),
      storyId: newGroupStoryId || undefined
    };

    setGroups(prev => [newGrp, ...prev]);
    setActiveGroupId(newGrpId);
    setActiveInterlocutorId(''); // clear active single
    setActiveTab('groups');
    setIsNewGroupOpen(false);
    setMobileShowThread(true);

    // reset fields
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupStoryId('');
    setGroupSelectedMembers([]);
  };

  const handleTriggerAutoDebate = () => {
    if (!activeGroupId || !activeGroup) return;

    // Find other members of the group
    const otherMembers = allUsers.filter(u => activeGroup.members.includes(u.id) && u.id !== currentUser.id);
    if (otherMembers.length === 0) return;

    const story = activeGroup.storyId ? stories.find(s => s.id === activeGroup.storyId) : null;

    // Define messages sequence
    const sequence = story 
      ? [
          {
            sender: otherMembers[0] || allUsers[1],
            content: `Franchement, j'ai commencé la lecture de "${story.title}" et je suis bluffé(e) par la plume de l'auteur ! Le style est vraiment immersif.`,
            delay: 1000
          },
          {
            sender: otherMembers[1] || otherMembers[0] || allUsers[2],
            content: `Ah oui ? J'aime beaucoup aussi ! Surtout la manière dont l'ambiance "${story.ambiance || story.genre}" s'installe dès le premier chapitre.`,
            delay: 3500
          },
          {
            sender: otherMembers[2] || otherMembers[0] || allUsers[3],
            content: `Je suis d'accord ! C'est très typique du genre "${story.genre}". C'est exactement le type d'œuvres qu'on aime voir partagées sur l'archipel PLUME.`,
            delay: 6000
          }
        ]
      : [
          {
            sender: otherMembers[0] || allUsers[1],
            content: "Je viens de terminer mes lectures en cours, vous auriez des pépites littéraires du moment à me conseiller dans l'archipel ?",
            delay: 1000
          },
          {
            sender: otherMembers[1] || otherMembers[0] || allUsers[2],
            content: "Tu as jeté un œil aux œuvres tendances ? Il y a des récits de SF et de Fantasy très sympas en ce moment.",
            delay: 3500
          },
          {
            sender: otherMembers[2] || otherMembers[0] || allUsers[3],
            content: "Carrément ! Et si certains d'entre vous écrivent, n'hésitez pas à poster vos brouillons ici pour avoir des bêta-lectures !",
            delay: 6000
          }
        ];

    // Trigger sequential messages
    sequence.forEach((msgInfo, idx) => {
      setTimeout(() => {
        // Double check we are still in the same group when message fires
        setGroupMessages(prev => {
          const newGMsg: GroupMessage = {
            id: `gmsg_auto_${Date.now()}_${idx}`,
            groupId: activeGroupId,
            senderId: msgInfo.sender.id,
            senderName: msgInfo.sender.username,
            senderAvatar: msgInfo.sender.avatar,
            content: msgInfo.content,
            date: new Date().toISOString()
          };

          // Also update the group's last message
          setGroups(prevGroups => prevGroups.map(g => g.id === activeGroupId ? {
            ...g,
            lastMessage: msgInfo.content,
            lastMessageDate: new Date().toISOString()
          } : g));

          return [...prev, newGMsg];
        });
      }, msgInfo.delay);
    });
  };

  // Start direct message selection
  const selectDirectAuthor = async (authorId: string) => {
    try {
      const conv = await onStartConversation([authorId]);
      setActiveGroupId(null);
      setActiveConversationId(conv.id);
      setIsNewChatOpen(false);
      setActiveTab('chats');
      setMobileShowThread(true);
    } catch (e: any) {
      console.error(e);
      alert(`Impossible de démarrer la conversation : ${e.message || 'erreur serveur'}`);
    }
  };

  // Toggle member selection in Group Creator
  const toggleSelectGroupMember = (uid: string) => {
    setGroupSelectedMembers(prev => 
      prev.includes(uid) 
        ? prev.filter(x => x !== uid) 
        : [...prev, uid]
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-1 sm:px-6 lg:px-8 py-5 md:py-8 lg:py-10 animate-fade-in text-left relative">
      
      {/* WhatsApp Layout Styled Container Card */}
      <div className="bg-gray-50 dark:bg-black border border-gray-200/50 dark:border-purple-900/15 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[80vh] min-h-[580px] md:h-[700px] shadow-2xl relative z-10">
        
        {/* LEFT COMPARTMENT: CHAT LISTINGS */}
        <div className={`md:col-span-4 bg-white dark:bg-[#0E0E14] flex flex-col border-r border-gray-200/90 dark:border-purple-900/15 ${
          mobileShowThread ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header with simply 'Messagerie' + sleek Action buttons */}
          <div className="px-5 py-4 bg-gray-100/75 dark:bg-black/60 border-b border-gray-200/40 dark:border-purple-900/15 flex justify-between items-center">
            <h2 className="text-base font-serif font-black tracking-tight text-gray-900 dark:text-white uppercase">
              Messagerie
            </h2>
            
            {/* Quick interactive shortcuts centered on user intents */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setIsNewChatOpen(true)}
                className="p-1.5 hover:bg-purple-100/60 dark:hover:bg-purple-950/20 rounded-full text-purple-600 dark:text-purple-400 font-bold transition flex items-center justify-center"
                title="Écrire un nouveau message"
              >
                <PlusCircle className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsNewGroupOpen(true)}
                className="p-1.5 hover:bg-purple-100/60 dark:hover:bg-purple-950/20 rounded-full text-purple-600 dark:text-purple-400 font-bold transition flex items-center justify-center"
                title="Créer un groupe de lecture"
              >
                <Users className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Symmetrical interactive Tabs with sleek indicator lines */}
          <div className="flex bg-gray-50 dark:bg-zinc-900/90 border-b border-gray-150 dark:border-zinc-805/45 text-xs font-semibold select-none">
            <button 
              type="button"
              onClick={() => { setActiveTab('chats'); setActiveGroupId(null); }}
              className={`flex-1 py-3 text-center transition-all border-b-2 font-serif uppercase tracking-wider text-[10px] ${
                activeTab === 'chats' && !activeGroupId
                  ? 'border-purple-600 text-[#7C3AED] dark:text-purple-400 font-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-950 dark:hover:text-zinc-200'
              }`}
            >
              Discussions
            </button>
            <button 
              type="button"
              onClick={() => { setActiveTab('groups'); }}
              className={`flex-1 py-3 text-center transition-all border-b-2 font-serif uppercase tracking-wider text-[10px] ${
                activeTab === 'groups'
                  ? 'border-purple-600 text-[#7C3AED] dark:text-purple-400 font-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-950 dark:hover:text-zinc-200'
              }`}
            >
              Groupes de lecture ({groups.length})
            </button>
          </div>

          {/* Search bar inside current listing */}
          <div className="p-2 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="relative bg-gray-100/85 dark:bg-zinc-800 rounded-lg flex items-center px-3 py-1.5 border border-transparent">
              <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2.5" />
              <input
                id="whatsapp-search-input"
                type="text"
                placeholder={activeTab === 'chats' ? "Rechercher une discussion solo" : "Rechercher un groupe de lecture"}
                className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 border-none outline-none focus:ring-0 p-0"
                disabled
              />
            </div>
          </div>

          {/* CONTACT & GROUPS DECK */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100/60 dark:divide-zinc-800/40 bg-white dark:bg-zinc-900">
            
            {/* Solo Discussions Deck View */}
            {activeTab === 'chats' && conversations.map((conv) => {
              const partner = conv.participants.find(p => p.id !== currentUser.id) || conv.participants[0] || currentUser;
              const isActive = conv.id === activeConversationId && !activeGroupId;
              const lastMsg = conv.messages[conv.messages.length - 1];
              const unreadCount = conv.unreadCount || 0;

              return (
                <button
                  key={conv.id}
                  id={`chat-partner-select-${partner.id}`}
                  onClick={() => {
                    setActiveGroupId(null);
                    setActiveConversationId(conv.id);
                    setMobileShowThread(true);
                  }}
                  className={`w-full text-left p-3.5 flex items-center space-x-3 transition-all relative border-l-4 ${
                    isActive 
                      ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-600' 
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-zinc-850/55'
                  }`}
                >
                  <div className="relative shrink-0 select-none">
                    <img
                      src={partner.avatar}
                      alt={partner.username}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100 dark:ring-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-purple-600 border-2 border-white dark:border-zinc-900 rounded-full"></span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-50 flex items-center">
                        {partner.username}
                        {partner.isVerified && <VerifiedBadge size="xs" className="ml-1" />}
                      </span>
                      <span className="text-[9px] text-gray-400 font-mono">
                        {lastMsg ? new Date(lastMsg.date || lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate pr-2 flex items-center space-x-1">
                        {lastMsg?.senderId === currentUser.id && (
                          <CheckCheck className="w-3.5 h-3.5 text-purple-650 dark:text-purple-450 shrink-0 inline mr-0.5" />
                        )}
                        <span>{lastMsg ? lastMsg.content : partner.bio || 'Aucun message de chat'}</span>
                      </p>
                      
                      {unreadCount > 0 && (
                        <span className="bg-purple-600 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Reading Groups Deck View */}
            {activeTab === 'groups' && groups.map((group) => {
              const isGroupActive = activeGroupId === group.id;
              
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setActiveGroupId(group.id);
                    setMobileShowThread(true);
                  }}
                  className={`w-full text-left p-3.5 flex items-center space-x-3 transition-all relative border-l-4 ${
                    isGroupActive 
                      ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-600' 
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-zinc-850/55'
                  }`}
                >
                  <div className="relative shrink-0 select-none">
                    <div className="w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center border border-purple-505/20 text-purple-600 dark:text-purple-400">
                      <BookOpen className="w-5 h-5 flex items-center justify-center" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-xs font-serif font-black text-gray-900 dark:text-gray-50 truncate max-w-[140px] block">
                        {group.name}
                      </span>
                      <span className="text-[9px] text-gray-400 font-mono">
                        {group.lastMessageDate ? new Date(group.lastMessageDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate pr-2">
                      <span className="text-purple-600 dark:text-purple-400 font-semibold mr-1">Récit:</span>
                      <span>{group.lastMessage || 'Aucune discussion récente'}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* SIMULATION SUMMARY FOOTER */}
          <div className="p-3 bg-purple-50/40 dark:bg-zinc-900/40 border-t border-gray-150 dark:border-zinc-850 flex items-start space-x-2 text-[10px] text-purple-600 dark:text-purple-300">
            <Sparkles className="w-5 h-5 shrink-0 text-[#7C3AED]" />
            <p className="leading-snug select-none">
              Nouveau message : {activeTab === 'chats' ? 'écrivez directement en solo' : 'gérez vos salons littéraires communautaires'}.
            </p>
          </div>
        </div>

        {/* RIGHT COMPARTMENT: ACTIVE CHAT THREAD WINDOW */}
        <div className={`md:col-span-8 flex flex-col justify-between bg-gray-50/50 dark:bg-zinc-950/90 h-full overflow-hidden relative ${
          mobileShowThread ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Wallpaper dynamic subtle visual anchor motif */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.015] pointer-events-none bg-[radial-gradient(#7C3AED_1px,transparent_1px)] [background-size:16px_16px] bg-repeat"></div>

          {/* Caller Screen overlay simulation (HIGH CRAFT INTERACTION) */}
          {callState !== 'idle' && (
            <div className="absolute inset-0 z-50 bg-zinc-950/95 flex flex-col justify-between items-center py-20 px-8 text-center animate-fade-in backdrop-blur-md">
              <div className="space-y-4">
                <div className="relative inline-block">
                  <div className="absolute -inset-4 rounded-full bg-purple-500/10 animate-ping duration-1000"></div>
                  <img
                    src={activeGroupId ? "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=150" : interlocutor.avatar}
                    alt="Appelant"
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-purple-600"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-black text-white">
                    {activeGroupId ? activeGroup?.name : interlocutor.username}
                  </h3>
                  <p className="text-xs text-purple-400 font-bold tracking-widest uppercase mt-2">
                    {callState === 'ringing' ? 'Appel audio entrant...' : 'Appel connecté'}
                  </p>
                </div>
              </div>

              {callState === 'connected' && (
                <div className="font-mono text-xl font-bold text-gray-200">
                  {formatCallTime(callDuration)}
                </div>
              )}

              <button
                type="button"
                onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-red-650 hover:bg-red-700 text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20 cursor-pointer"
                title="Raccrocher"
              >
                <X className="w-6 h-6 shrink-0" />
              </button>
            </div>
          )}

          {/* Thread Header */}
          <div className="px-4 py-3 bg-[#0F0F14] text-white flex items-center justify-between border-b border-zinc-800/80 z-10 shrink-0 mb-0.5">
            <div className="flex items-center space-x-3 min-w-0">
              {/* Back mobile button */}
              <button 
                onClick={() => {
                  setMobileShowThread(false);
                  setActiveGroupId(null);
                  setActiveConversationId('');
                }}
                className="p-1.5 -ml-1.5 md:hidden hover:bg-zinc-800 rounded-full text-zinc-300 mr-1"
                title="Retour à la liste"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Header profile photo & title representation */}
              {activeGroupId ? (
                // Group Header Style
                <>
                  <div className="w-10 h-10 rounded-full bg-purple-950/50 flex items-center justify-center text-purple-400 font-bold shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-left min-w-0">
                    <h4 className="text-xs font-serif font-black text-white leading-none truncate max-w-[190px]">
                      {activeGroup?.name}
                    </h4>
                    <p className="text-[9px] text-[#A78BFA] font-bold mt-1.5 truncate max-w-[190px]">
                      {activeGroup?.description}
                    </p>
                  </div>
                </>
              ) : (
                // Direct Solo Chat Header Style
                <>
                  <div className="relative shrink-0">
                    <img
                      src={interlocutor.avatar}
                      alt={interlocutor.username}
                      className="w-10 h-10 rounded-full object-cover border border-zinc-800 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-purple-600 border border-zinc-900 rounded-full"></span>
                  </div>
                  
                  <div className="text-left min-w-0">
                    <h4 className="text-xs font-serif font-black text-white leading-none flex items-center">
                      <span>{interlocutor.username}</span>
                      {interlocutor.isVerified && <VerifiedBadge size="xs" className="ml-1" />}
                    </h4>
                    <p className="text-[10px] text-white/90 font-bold mt-1.5">
                      en ligne • {interlocutor.role}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Quick action tools - NO VIDEO: ONLY AUDIO per user's requests! */}
            <div className="flex items-center space-x-1 text-zinc-400 shrink-0">
              <button 
                type="button"
                className="p-2 hover:bg-zinc-800 rounded-full transition text-[#7C3AED] dark:text-purple-400" 
                title="Lancer un appel audio" 
                onClick={handleStartCall}
              >
                <Phone className="w-4 h-4 scale-105" />
              </button>
              <button 
                type="button"
                className="p-2 hover:bg-zinc-800 rounded-full transition"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeGroupId && activeGroup?.storyId && (() => {
            const story = stories.find(s => s.id === activeGroup.storyId);
            if (!story) return null;
            return (
              <div className="px-4 py-2 bg-purple-50/70 dark:bg-purple-950/20 border-b border-gray-200/50 dark:border-purple-500/10 backdrop-blur-md flex items-center justify-between shrink-0 animate-fade-in select-none">
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={story.cover || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=150'}
                    alt={story.title}
                    className="w-7 h-10 object-cover rounded shadow-md border border-purple-500/20 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-left min-w-0">
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 leading-tight uppercase font-mono font-bold">Ouvrage en débat</p>
                    <h5 className="text-xs font-serif font-black text-gray-900 dark:text-white truncate max-w-[170px] sm:max-w-[320px] md:max-w-[200px] lg:max-w-[350px]">
                      {story.title}
                    </h5>
                    <p className="text-[9px] text-purple-600 dark:text-purple-400 font-bold">par {story.authorName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectStory(story)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 flex items-center space-x-1 cursor-pointer shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>Lire l'œuvre</span>
                </button>
              </div>
            );
          })()}

          {/* ACTIVE CHAT WORKSPACE AREA */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto z-10 space-y-3.5 max-h-[460px]">
            {activeGroupId ? (
              // Group Thread messaging
              activeGroupMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/20 flex items-center justify-center mb-4 text-[#7C3AED]">
                    <Users className="w-8 h-8" />
                  </div>
                  <h5 className="font-bold text-gray-900 dark:text-gray-105 text-sm">Groupe de lecture sécurisé</h5>
                  <p className="text-xs text-gray-400 max-w-xs mt-1 leading-relaxed">
                    Les membres de ce cercle de lecture peuvent tous échanger ici. Écrivez le premier message coopératif !
                  </p>
                </div>
              ) : (
                activeGroupMessages.map((msg) => {
                  const isSentByMe = msg.senderId === currentUser.id;
                  const isVoiceStr = msg.content.startsWith('[🎙️ Note Vocale');

                  return (
                    <div 
                      key={msg.id}
                      className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    >
                      <div className={`relative max-w-[85.5%] md:max-w-[75%] px-3.5 py-2 shadow-sm rounded-xl ${
                        isSentByMe 
                          ? 'bg-purple-600 dark:bg-purple-700 text-white rounded-tr-none text-right' 
                          : 'bg-black text-white rounded-tl-none border border-zinc-800 text-left'
                      }`}>
                        
                        <span className={`absolute top-0 w-2 h-2 ${
                          isSentByMe 
                            ? 'right-[-5px] bg-purple-600 dark:bg-purple-700 rounded-bl-full' 
                            : 'left-[-5px] bg-black rounded-br-full'
                        }`}></span>

                        {/* Group member identifier tag top */}
                        {!isSentByMe && (
                          <div className="flex items-center space-x-1 mb-1 border-b border-zinc-800 pb-0.5">
                            <img 
                              src={msg.senderAvatar} 
                              alt={msg.senderName} 
                              className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-purple-400/20"
                            />
                            <span className="text-[9px] font-sans font-black text-purple-400">
                              {msg.senderName}
                            </span>
                          </div>
                        )}

                        {/* Content text or Voice wrapper */}
                        {isVoiceStr ? (
                          <VoicePlayerMockup 
                            durationStr={msg.content.match(/Note Vocale - ([\d:]+)/)?.[1] || '0:05'} 
                            isSentByMe={isSentByMe} 
                          />
                        ) : (
                          <p className="text-xs leading-relaxed break-words text-left">
                            {msg.content}
                          </p>
                        )}

                        <div className={`flex items-center justify-end space-x-1 mt-1 text-[8.5px] font-mono ${
                          isSentByMe ? 'text-purple-200' : 'text-zinc-400'
                        }`}>
                          <span>
                            {new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isSentByMe && <CheckCheck className="w-3 h-3 text-purple-200" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              // Direct solo Message thread
              threadMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/20 flex items-center justify-center mb-4 text-[#7C3AED]">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <h5 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Chiffrement de bout en bout</h5>
                  <p className="text-xs text-gray-400 max-w-xs mt-1 leading-relaxed">
                    Vos conversations privées sont locales et chiffrées. Échangez avec le romancier {interlocutor.username}.
                  </p>
                </div>
              ) : (
                threadMessages.map((msg) => {
                  const isSentByMe = msg.senderId === currentUser.id;
                  const isVoiceStr = msg.content.startsWith('[🎙️ Note Vocale');

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} animate-fade-in`}
                    >
                      <div className={`relative max-w-[80.5%] md:max-w-[70%] px-3 py-1.5 shadow-sm rounded-xl ${
                        isSentByMe 
                          ? 'bg-purple-600 dark:bg-purple-700 text-white rounded-tr-none text-right' 
                          : 'bg-black text-white rounded-tl-none border border-zinc-800/85 text-left'
                      }`}>
                        
                        <span className={`absolute top-0 w-2 h-2 ${
                          isSentByMe 
                            ? 'right-[-5px] bg-purple-600 dark:bg-purple-700 rounded-bl-full' 
                            : 'left-[-5px] bg-black rounded-br-full'
                        }`}></span>

                        {isVoiceStr ? (
                          <VoicePlayerMockup 
                            durationStr={msg.content.match(/Note Vocale - ([\d:]+)/)?.[1] || '0:05'} 
                            isSentByMe={isSentByMe} 
                          />
                        ) : (
                          <p className="text-xs leading-relaxed break-words pr-1 text-left">
                            {msg.content}
                          </p>
                        )}
                        
                        <div className={`flex items-center justify-end space-x-1 mt-1 text-[9px] font-mono ${
                          isSentByMe ? 'text-purple-200' : 'text-zinc-400'
                        }`}>
                          <span>
                            {new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isSentByMe && (
                            msg.isRead ? (
                              <CheckCheck className="w-3.5 h-3.5 text-purple-200 shrink-0 inline" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-purple-300/60 shrink-0 inline" />
                            )
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })
              )
            )}
              <div ref={messagesEndRef} />
            </div>

            {/* ACTIVE DISCUSSION PANEL CONTROLS FOOTER */}
            <div className="z-10 bg-gray-100/75 dark:bg-zinc-900/60 border-t border-gray-200/50 dark:border-zinc-800 p-2.5 shrink-0 space-y-2">
            
              {/* Standard message input bar */}
              <form onSubmit={handleSend} className="flex items-center space-x-1.5">
                <button 
                  type="button" 
                  className="p-1.5 text-[#7C3AED] dark:text-purple-400 hover:bg-gray-200/55 dark:hover:bg-zinc-850 rounded-full transition-all shrink-0" 
                  title="Insérer plume"
                  onClick={() => setMessageText(prev => prev + ' ✒️')}
                >
                  <Smile className="w-5 h-5 shrink-0" />
                </button>

                <input
                  id="message-input-chat-box"
                  type="text"
                  placeholder={activeGroupId ? "Message de groupe..." : "Rédiger votre message..."}
                  className="flex-1 bg-white dark:bg-zinc-800 border border-transparent focus:border-[#7C3AED]/35 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500/35 text-gray-800 dark:text-gray-150 placeholder-gray-400"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />

                <button
                  id="send-message-chat-btn"
                  type="submit"
                  disabled={!messageText.trim()}
                  className={`bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-full transition shrink-0 shadow-sm flex items-center justify-center ${
                    !messageText.trim() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
                  }`}
                  title="Envoyer"
                >
                  <Send className="w-4 h-4 transform rotate-0 shrink-0" />
                </button>
              </form>

            {/* SIMULATION PANEL DRAWER (Immersive interactive testing experience) */}
            <div className="bg-white/80 dark:bg-zinc-950/45 border border-purple-500/10 dark:border-purple-500/5 rounded-xl overflow-hidden shadow-xs">
              <button
                type="button"
                id="toggle-simulator-drawer"
                onClick={() => setShowSimPanel(!showSimPanel)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase font-mono font-bold text-gray-400 dark:text-zinc-400 hover:text-[#7C3AED] transition-colors"
              >
                <span className="flex items-center space-x-1.5 text-purple-600 dark:text-purple-400 select-none">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Atelier d’émulation de réponses</span>
                </span>
                {showSimPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showSimPanel && (
                <div className="p-2.5 border-t border-gray-100 dark:border-zinc-850 bg-purple-550/5 dark:bg-purple-950/5 select-none text-left">
                  <form onSubmit={handleSimulatedReceive} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <span className="text-[9.5px] uppercase font-mono font-bold text-gray-400 truncate max-w-[200px] shrink-0">
                      En tant que {activeGroupId ? 'un membre du groupe' : interlocutor.username.split(' ')[0]} :
                    </span>
                    
                    <div className="flex-1 flex gap-2">
                      <input
                        id="simulation-respond-input"
                        type="text"
                        placeholder={activeGroupId ? "Réponse d'un membre du groupe..." : `Réponse d'auteur simulée de ${interlocutor.username}...`}
                        value={simulationText}
                        onChange={(e) => setSimulationText(e.target.value)}
                        className="flex-1 bg-white/95 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-[10px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500 italic text-gray-80/90 dark:text-gray-100"
                      />
                      <button
                        id="simulate-msg-btn"
                        type="submit"
                        disabled={!simulationText.trim()}
                        className={`bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg px-3 py-1.5 text-[9px] uppercase tracking-wider transition shrink-0 ${
                          !simulationText.trim() ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'
                        }`}
                      >
                        Simuler
                      </button>
                      {activeGroupId && (
                        <button
                          type="button"
                          onClick={handleTriggerAutoDebate}
                          className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-lg px-3 py-1.5 text-[9px] uppercase tracking-wider transition shrink-0 active:scale-95 cursor-pointer"
                          title="Déclencher une discussion automatique simulée entre les membres"
                        >
                          Débat Auto
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* POPUP MODAL: WRITE A NEW DIRECT MESSAGE */}
      {isNewChatOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in text-left">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between">
              <h3 className="text-sm font-serif font-black text-gray-950 dark:text-gray-105 uppercase tracking-wider flex items-center space-x-1.5">
                <PlusCircle className="w-5 h-5 text-purple-600" />
                <span>Nouveau Message</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-400 dark:text-zinc-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 dark:border-zinc-850">
              <div className="relative bg-gray-50 dark:bg-zinc-950 rounded-xl flex items-center px-3 py-2">
                <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
                <input
                  type="text"
                  placeholder="Rechercher un auteur par nom..."
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 border-none outline-none focus:ring-0 p-0"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-[10px] font-mono font-bold text-gray-450 uppercase mb-2">Auteurs disponibles ({allUsers.filter(u => u.id !== currentUser.id).length})</p>
              {allUsers
                .filter(u => u.id !== currentUser.id)
                .filter(u => u.username.toLowerCase().includes(authorSearch.toLowerCase()))
                .map((userObj) => (
                  <button
                    key={userObj.id}
                    onClick={() => selectDirectAuthor(userObj.id)}
                    className="w-full flex items-center space-x-3.5 p-3 rounded-2xl hover:bg-purple-500/5 dark:hover:bg-purple-950/15 border border-gray-55/10 hover:border-purple-600/20 text-left transition"
                  >
                    <img
                      src={userObj.avatar}
                      alt={userObj.username}
                      className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-purple-600/5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{userObj.username}</span>
                        <span className="text-[9px] font-mono text-purple-600 font-extrabold uppercase bg-purple-50 dark:bg-purple-950/20 px-1 rounded">{userObj.role}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{userObj.bio || "Aucune biographie"}</p>
                    </div>
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL: CREATE A READING GROUP */}
      {isNewGroupOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in text-left">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-850 flex items-center justify-between">
              <h3 className="text-sm font-serif font-black text-gray-950 dark:text-gray-105 uppercase tracking-wider flex items-center space-x-1.5 select-none">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Créer un groupe de lecture</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewGroupOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-400 dark:text-zinc-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase text-gray-400">Nom du groupe de lecture</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Passion Thriller, Club Victor Hugo, etc."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-xs text-gray-805 dark:text-gray-105 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-650"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase text-gray-400">Description ou thème</label>
                <input
                  type="text"
                  placeholder="Ex: Lecture partagée des oeuvres classiques gothiques."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-805 text-xs text-gray-805 dark:text-gray-105 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-650"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase text-gray-400">Ouvrage lié (Optionnel)</label>
                <select
                  value={newGroupStoryId}
                  onChange={(e) => setNewGroupStoryId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-805 text-xs text-gray-800 dark:text-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-650"
                >
                  <option value="">-- Aucun ouvrage associé --</option>
                  {stories.map((story) => (
                    <option key={story.id} value={story.id}>
                      {story.title} (par {story.authorName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 flex-1 flex flex-col">
                <label className="text-[10px] font-mono font-bold uppercase text-gray-400">Membres fondateurs à inviter</label>
                <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 max-h-[170px] overflow-y-auto space-y-1.5">
                  {allUsers
                    .filter(u => u.id !== currentUser.id)
                    .map((memberUser) => {
                      const isSelected = groupSelectedMembers.includes(memberUser.id);
                      return (
                        <div 
                          key={memberUser.id}
                          onClick={() => toggleSelectGroupMember(memberUser.id)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <img
                              src={memberUser.avatar}
                              alt={memberUser.username}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                            <span className="font-bold text-gray-900 dark:text-gray-100">{memberUser.username}</span>
                          </div>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-purple-600 border-purple-600 text-white' 
                              : 'border-gray-300 dark:border-zinc-700'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white fill-current shrink-0" />}
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>

              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition duration-150 shadow-md shadow-purple-500/10 uppercase"
              >
                Créer le cercle de lecture
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
