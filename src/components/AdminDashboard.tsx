/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Trash2, 
  ShieldAlert, 
  CheckCircle, 
  Users, 
  BookOpen, 
  UserPlus, 
  X, 
  Check, 
  Award,
  SlidersHorizontal,
  FolderLock
} from 'lucide-react';
import { User, Story } from '../types';
import { VerifiedBadge } from './VerifiedBadge';

interface AdminDashboardProps {
  currentUser: User;
  allUsers: User[];
  stories: Story[];
  onToggleUserVerification: (userId: string) => void;
  onBanUser: (userId: string) => void;
  onDeleteStory: (storyId: string) => void;
  onDismissFlag: (storyId: string) => void;
  onDismissUserFlag: (userId: string) => void;
}

export default function AdminDashboard({
  currentUser,
  allUsers,
  stories,
  onToggleUserVerification,
  onBanUser,
  onDeleteStory,
  onDismissFlag,
  onDismissUserFlag
}: AdminDashboardProps) {

  const [activeSegment, setActiveSegment] = useState<'moderation' | 'users-management'>('moderation');

  // Compute stats metrics
  const totalVerifiedAuthors = allUsers.filter(u => u.isVerified).length;
  const flaggedStories = stories.filter(s => s.isFlagged);
  const flaggedUsers = allUsers.filter(u => u.isFlagged);
  const aggregateVols = stories.reduce((sum, s) => sum + s.views, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in text-left">
      
      {/* Intro banner */}
      <div>
        <h1 className="text-2xl md:text-3xl font-sans font-bold text-gray-900 dark:text-white flex items-center space-x-2">
          <ShieldCheck className="w-7 h-7 text-purple-600" />
          <span>Panneau de Modération Administrative</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Supervisez la sécurité de PLUME, attribuez les certifications d'authenticité, et traitez les signalements communautaires.
        </p>
      </div>

      {/* Global Analytics Board */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-[#0E0E14] border border-[#ecebf6] dark:border-purple-900/15 rounded-2xl p-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Membres Actifs</span>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1.5">{allUsers.length}</p>
          <div className="text-[9px] text-gray-455 mt-1">Gérés sous la charte PLUME</div>
        </div>

        <div className="bg-white dark:bg-[#0E0E14] border border-[#ecebf6] dark:border-purple-900/15 rounded-2xl p-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Publications Globales</span>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1.5">{stories.length}</p>
          <div className="text-[9px] text-gray-455 mt-1">{stories.filter(s => s.status === 'Publié').length} Récits publiés</div>
        </div>

        <div className="bg-white dark:bg-[#0E0E14] border border-[#ecebf6] dark:border-purple-900/15 rounded-2xl p-5">
          <span className="text-[10px] font-bold text-purple-650 dark:text-purple-400 uppercase tracking-wider block">Signalements Actifs</span>
          <p className="text-2xl font-bold font-mono text-purple-600 mt-1.5">{flaggedStories.length}</p>
          <div className="text-[9px] text-purple-500/80 mt-1">Histoires nécessitant enquête</div>
        </div>

        <div className="bg-white dark:bg-[#0E0E14] border border-[#ecebf6] dark:border-purple-900/15 rounded-2xl p-5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Lectures Cumulées</span>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1.5">{aggregateVols}</p>
          <div className="text-[9px] text-gray-455 mt-1">Vues de chapitres cumulées</div>
        </div>

      </div>

      {/* Navigation Tabs between Moderation and Users */}
      <div className="flex bg-gray-100 dark:bg-black p-1 rounded-xl self-start w-fit border border-gray-200/50 dark:border-purple-900/15">
        <button
          id="admin-tab-moderation"
          onClick={() => setActiveSegment('moderation')}
          className={`flex items-center space-x-1.5 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeSegment === 'moderation'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-purple-600'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Fiche des Signalements ({flaggedStories.length})</span>
        </button>

        <button
          id="admin-tab-users"
          onClick={() => setActiveSegment('users-management')}
          className={`flex items-center space-x-1.5 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeSegment === 'users-management'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-purple-600'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Certifications et Vérification des Auteurs</span>
        </button>
      </div>

      {/* Routing content views */}
      {activeSegment === 'moderation' ? (
        /* MODERATION CASE TABS */
        <div className="space-y-8 animate-fade-in">
          
          {/* SECTION : HISTOIRES SIGNALÉES */}
          <div className="space-y-4">
            <h3 className="font-sans font-bold text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-purple-500/10 pb-2 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Histoires Signalées ({flaggedStories.length})</span>
            </h3>

            {flaggedStories.length === 0 ? (
              <div className="bg-white dark:bg-[#0E0E14] border border-gray-200/60 dark:border-purple-900/15 rounded-2xl py-8 text-center min-h-[140px] flex flex-col justify-center items-center">
                <CheckCircle className="w-8 h-8 text-purple-500/70 mb-2" />
                <h4 className="font-sans font-bold text-xs text-gray-800 dark:text-white leading-tight">Aucun récit signalé</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Félicitations ! Tous les récits respectent pleinement la charte de PLUME.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flaggedStories.map((story) => (
                  <div 
                    key={story.id} 
                    id={`flagged-story-admin-card-${story.id}`}
                    className="bg-white dark:bg-[#0E0E14] border-l-4 border-purple-600 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs border-r border-t border-b border-gray-150 dark:border-purple-900/15"
                  >
                    
                    {/* Left part: details on why the story is flagged */}
                    <div className="space-y-2 flex-1 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-405 uppercase tracking-widest bg-purple-500/10 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">
                          Récit Signalé
                        </span>
                        <span className="text-xs font-mono text-gray-400">ID: {story.id}</span>
                      </div>

                      <h4 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">{story.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal line-clamp-2">
                        Synopsis: {story.description}
                      </p>

                      <div className="p-3 bg-purple-500/5 dark:bg-purple-950/15 border border-purple-500/10 dark:border-purple-900/25 rounded-xl">
                        <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold leading-relaxed">
                          <strong className="uppercase font-sans tracking-wide text-[10px] mr-1 block sm:inline">Motif du signalement :</strong>
                          {story.flagReason || 'Aucun motif de signalement spécifié.'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] text-gray-400">
                        <span>Auteur : <strong>{story.authorName}</strong></span>
                        <span>•</span>
                        <span>Genre : <strong>{story.genre}</strong></span>
                      </div>
                    </div>

                    {/* Actions buttons panel */}
                    <div className="flex items-center space-x-2 w-full md:w-auto justify-end flex-shrink-0">
                      <button
                        id={`dismiss-flag-btn-${story.id}`}
                        onClick={() => {
                          onDismissFlag(story.id);
                          alert(`Le signalement de "${story.title}" a été annulé avec succès.`);
                        }}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Rétablir le récit</span>
                      </button>

                      <button
                        id={`delete-story-admin-btn-${story.id}`}
                        onClick={() => {
                          if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement et de forcer la dépublication de "${story.title}" ?`)) {
                            onDeleteStory(story.id);
                          }
                        }}
                        className="px-3.5 py-2 bg-black hover:bg-purple-950 text-white border border-purple-900/40 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer le récit</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION : COMPTES D'UTILISATEURS SIGNALÉS */}
          <div className="space-y-4 pt-4">
            <h3 className="font-sans font-bold text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-purple-500/10 pb-2 flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Comptes d'Utilisateurs Signalés ({flaggedUsers.length})</span>
            </h3>

            {flaggedUsers.length === 0 ? (
              <div className="bg-white dark:bg-[#0E0E14] border border-gray-200/60 dark:border-purple-900/15 rounded-2xl py-8 text-center min-h-[140px] flex flex-col justify-center items-center">
                <CheckCircle className="w-8 h-8 text-purple-600/70 mb-2" />
                <h4 className="font-sans font-bold text-xs text-gray-800 dark:text-white leading-tight">Aucun compte signalé</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Tous les membres de PLUME se comportent de manière exemplaire.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flaggedUsers.map((user) => (
                  <div 
                    key={user.id} 
                    id={`flagged-user-admin-card-${user.id}`}
                    className="bg-white dark:bg-[#0E0E14] border-l-4 border-purple-600 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs border-r border-t border-b border-gray-150 dark:border-purple-900/15"
                  >
                    
                    {/* Left part: details on why the user is flagged */}
                    <div className="space-y-2 flex-1 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-405 uppercase tracking-widest bg-purple-500/10 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">
                          Compte Signalé
                        </span>
                        <span className="text-xs font-mono text-gray-400">ID: {user.id}</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-600/10"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-gray-950 dark:text-white tracking-tight flex items-center space-x-1.5 leading-none">
                            <span>{user.username}</span>
                            {user.isVerified && <VerifiedBadge size="sm" />}
                          </h4>
                          <span className="text-[10px] text-zinc-400">{user.email} • Rôle : {user.role}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-purple-500/5 dark:bg-purple-950/15 border border-purple-500/10 dark:border-purple-900/25 rounded-xl">
                        <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold leading-relaxed">
                          <strong className="uppercase font-sans tracking-wide text-[10px] mr-1 block sm:inline">Motif du signalement :</strong>
                          {user.flagReason || 'Aucun motif de signalement spécifié.'}
                        </p>
                      </div>
                    </div>

                    {/* Actions buttons panel */}
                    <div className="flex items-center space-x-2 w-full md:w-auto justify-end flex-shrink-0">
                      <button
                        id={`dismiss-user-flag-btn-${user.id}`}
                        onClick={() => {
                          onDismissUserFlag(user.id);
                          alert(`Le signalement du compte de @${user.username} a été absous avec succès.`);
                        }}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Rétablir le compte</span>
                      </button>

                      <button
                        id={`ban-user-admin-btn-${user.id}`}
                        onClick={() => {
                          if (confirm(`Voulez-vous suspendre définitivement l’utilisateur @${user.username} de PLUME ?`)) {
                            onBanUser(user.id);
                            alert(`Le compte de @${user.username} a été banni avec succès.`);
                          }
                        }}
                        className="px-3.5 py-2 bg-black hover:bg-purple-950 text-white border border-purple-900/40 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Bannir le compte</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* AUTHORS LIST / VERIFY CERTIFICATIONS */
        <div className="space-y-4">
          <h3 className="font-sans font-bold text-xs text-gray-400 uppercase tracking-wider block">
            Attribution des certifications d'Authenticité Plume
          </h3>

          <div className="bg-white dark:bg-[#0E0E14] border border-gray-200/50 dark:border-purple-900/15 rounded-2xl overflow-hidden divide-y divide-[#ecebf6]/30 dark:divide-purple-900/15">
            {allUsers.map((user) => {
              return (
                <div 
                  key={user.id} 
                  id={`admin-user-row-${user.id}`}
                  className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left"
                >
                  
                  {/* Left details */}
                  <div className="flex items-center space-x-3">
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-600/10"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                          {user.username}
                        </span>
                        {user.isVerified && <VerifiedBadge size="sm" />}
                      </div>
                      <p className="text-[10px] text-gray-400">{user.email} • Rôle : {user.role}</p>
                    </div>
                  </div>

                  {/* Operational controls */}
                  <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                    
                    <button
                      id={`toggle-verification-${user.id}`}
                      onClick={() => onToggleUserVerification(user.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 border cursor-pointer ${
                        user.isVerified 
                          ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-750' 
                          : 'bg-purple-500/10 dark:bg-purple-950/40 border-purple-500/20 text-purple-600 hover:bg-purple-500/20'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{user.isVerified ? 'Retirer certification' : `Certifier (${user.role === 'Lecteur' ? 'Lecteur' : 'Auteur'})`}</span>
                    </button>

                    {/* Ban user button if it isn't myself or another admin */}
                    {user.id !== currentUser.id && user.role !== 'Administrateur' && (
                      <button
                        id={`ban-user-btn-${user.id}`}
                        onClick={() => {
                          if (confirm(`Voulez-vous suspendre définitivement l’utilisateur @${user.username} de PLUME ?`)) {
                            onBanUser(user.id);
                          }
                        }}
                        className="p-1.5 px-3 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-950/20 hover:bg-purple-500/20 rounded-lg transition cursor-pointer"
                      >
                        Bannir
                      </button>
                    )}

                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
