/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pied de page « site web » — visible uniquement sur grand ecran (>= lg).
 * Sur mobile, l'app garde son ergonomie plein ecran (pas de footer).
 */

import { Feather, LogOut } from 'lucide-react';

type Tab = 'home' | 'explore' | 'write' | 'messages' | 'profile' | 'admin' | 'achievements';

interface SiteFooterProps {
  onChangeTab: (tab: Tab) => void;
  canWrite?: boolean;
  onLogout?: () => void;
}

export default function SiteFooter({ onChangeTab, canWrite, onLogout }: SiteFooterProps) {
  const year = 2026;
  return (
    <footer className="hidden lg:block border-t border-gray-150 dark:border-purple-900/15 bg-gray-50 dark:bg-[#0B0B10] mt-8">
      <div className="max-w-none mx-auto px-6 lg:px-10 xl:px-16 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        {/* Marque */}
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white flex items-center justify-center">
              <Feather className="w-4 h-4" />
            </span>
            <span className="font-serif font-black text-lg text-gray-900 dark:text-white">PLUME</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-[220px]">
            Lisez, écrivez et partagez des histoires. Une communauté de lecteurs et d'auteurs.
          </p>
        </div>

        {/* Decouvrir */}
        <div>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Découvrir</h4>
          <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
            <li><button onClick={() => onChangeTab('home')} className="hover:text-purple-600 dark:hover:text-purple-400 transition">Accueil</button></li>
            <li><button onClick={() => onChangeTab('explore')} className="hover:text-purple-600 dark:hover:text-purple-400 transition">Parcourir la bibliothèque</button></li>
            <li><button onClick={() => onChangeTab('achievements')} className="hover:text-purple-600 dark:hover:text-purple-400 transition">Succès</button></li>
          </ul>
        </div>

        {/* Creer */}
        <div>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Créer</h4>
          <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
            <li><button onClick={() => onChangeTab(canWrite ? 'write' : 'profile')} className="hover:text-purple-600 dark:hover:text-purple-400 transition">{canWrite ? 'Écrire une œuvre' : 'Devenir auteur'}</button></li>
            <li><button onClick={() => onChangeTab('messages')} className="hover:text-purple-600 dark:hover:text-purple-400 transition">Messagerie</button></li>
            <li><button onClick={() => onChangeTab('profile')} className="hover:text-purple-600 dark:hover:text-purple-400 transition">Mon profil</button></li>
          </ul>
        </div>

        {/* Communaute */}
        <div>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Communauté</h4>
          <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
            <li><span className="text-gray-400">Règles de la communauté</span></li>
            <li><span className="text-gray-400">Confidentialité</span></li>
            <li><span className="text-gray-400">Conditions d'utilisation</span></li>
            {onLogout && (
              <li className="pt-1.5">
                <button
                  id="footer-logout"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-bold transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Déconnexion
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-150 dark:border-zinc-900">
        <div className="max-w-none mx-auto px-6 lg:px-10 xl:px-16 py-4 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">© {year} PLUME — Tous droits réservés.</span>
          <span className="text-[11px] text-gray-400 flex items-center gap-1">Fait avec <span className="text-purple-500">🪶</span></span>
        </div>
      </div>
    </footer>
  );
}
