/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bandeau d'installation de la PWA — visible et simple. Affiche le bouton
 * d'installation natif (Android / ordinateur) ou, sur iPhone, le mode d'emploi
 * « Ajouter à l'écran d'accueil ». Masqué dans l'APK natif et une fois installé.
 */

import { useEffect, useState } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { canInstall, isIos, isNativeApp, isStandalone, onInstallAvailability, promptInstall } from '../utils/pwa';

const DISMISS_KEY = 'plume_install_dismissed';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [installable, setInstallable] = useState(canInstall());
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isNativeApp() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const off = onInstallAvailability((can) => setInstallable(can));
    // Sur iPhone/iPad, l'invite native n'existe pas : on propose le mode d'emploi.
    const ios = isIos() && !isStandalone();
    // On laisse à l'app le temps de se charger avant d'afficher le bandeau.
    const t = window.setTimeout(() => setShow(true), 2500);
    setIosHint(ios);
    return () => { off(); clearTimeout(t); };
  }, []);

  if (!show || isNativeApp() || isStandalone()) return null;
  if (!installable && !iosHint) return null;

  const dismiss = () => { setShow(false); try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ } };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2147481000] px-3 pointer-events-none" style={{ paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto mx-auto max-w-md bg-white dark:bg-[#15131c] border border-gray-200 dark:border-purple-900/30 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-slide-up">
        <img src="/app-icon.png" alt="PLUME" className="w-11 h-11 rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black text-gray-900 dark:text-white leading-tight">Installer PLUME</p>
          {iosHint ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5 flex items-center flex-wrap gap-x-1">
              Touche <Share className="inline w-3.5 h-3.5 -mt-0.5 text-[#7C3AED]" /> puis <span className="font-bold">« Sur l'écran d'accueil »</span> <Plus className="inline w-3.5 h-3.5 -mt-0.5 text-[#7C3AED]" />
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">Accès rapide, notifications et plein écran, comme une vraie app.</p>
          )}
        </div>
        {!iosHint && (
          <button
            onClick={async () => { const ok = await promptInstall(); if (ok) dismiss(); }}
            className="shrink-0 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black uppercase tracking-wide px-3 py-2 rounded-xl"
          >
            <Download className="w-3.5 h-3.5" /> Installer
          </button>
        )}
        <button onClick={dismiss} className="shrink-0 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
