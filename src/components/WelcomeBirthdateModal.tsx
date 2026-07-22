/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modale de bienvenue affichée quand un compte n'a pas encore de date de
 * naissance (typiquement après une inscription « Continuer avec Google », qui
 * ne fournit pas l'âge). Elle : (1) informe l'utilisateur qu'il est en mode
 * LECTEUR, (2) collecte sa date de naissance — indispensable pour afficher les
 * œuvres adaptées à son âge (sans elle, l'âge vaut 0 et le contenu classé est
 * masqué). Impossible à fermer sans saisir une date valide (13 ans minimum).
 */

import { useState } from 'react';
import { Feather, BookOpen, Calendar } from 'lucide-react';

interface Props {
  username: string;
  isReader: boolean; // afficher la mention « mode Lecteur »
  onSubmit: (birthDate: string) => Promise<void>;
}

export default function WelcomeBirthdateModal({ username, isReader, onSubmit }: Props) {
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setError('');
    if (!birthDate) { setError('Indique ta date de naissance.'); return; }
    const d = new Date(birthDate);
    if (isNaN(d.getTime()) || d >= new Date()) { setError('Date invalide.'); return; }
    const years = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years < 13) { setError('Tu dois avoir au moins 13 ans pour utiliser PLUME.'); return; }
    setBusy(true);
    try {
      await onSubmit(birthDate);
    } catch (e: any) {
      setError(e?.message || 'Enregistrement impossible. Réessaie.');
    } finally {
      // TOUJOURS relâcher `busy`, même en cas de succès : le parent
      // (handleUpdateProfile) NE lève PAS d'exception en cas d'échec réseau —
      // il affiche son alerte et laisse la modale montée. Sans ce finally, un
      // échec transitoire (Render à froid, 401 de course juste après un signup
      // Google) figeait le bouton sur « Enregistrement… » et verrouillait
      // l'utilisateur hors de l'app derrière une modale plein écran non fermable.
      setBusy(false);
    }
  };

  const maxDate = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-[#0E0E14] rounded-[1.75rem] border border-purple-500/20 shadow-2xl overflow-hidden">
        {/* En-tête de MARQUE, façon écran de connexion PLUME (dégradé violet,
            plume dans un médaillon, accroche). */}
        <div className="relative bg-gradient-to-br from-purple-700 via-purple-600 to-fuchsia-600 px-6 pt-7 pb-6 text-white text-center overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-fuchsia-300/20 blur-2xl pointer-events-none" />
          <span className="relative inline-flex w-14 h-14 rounded-2xl bg-white/15 backdrop-blur items-center justify-center mb-2.5 ring-1 ring-white/20">
            <Feather className="w-7 h-7" />
          </span>
          <h2 className="relative font-serif font-black text-xl leading-tight">Bienvenue sur PLUME</h2>
          <p className="relative text-[11px] text-white/85 mt-1">Ravi de te compter parmi nous, <span className="font-bold">{username}</span> 🪶</p>
          <p className="relative text-[10px] text-white/70 mt-1 italic">Lisez, écrivez, partagez — votre imaginaire prend vie.</p>
        </div>

        <div className="p-6 space-y-4">
          {isReader && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-purple-500/10 border border-purple-500/15">
              <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-snug">
                Ton compte a été créé en <span className="font-black text-purple-700 dark:text-purple-300">mode Lecteur</span>.
                Tu pourras devenir <span className="font-bold">Auteur</span> quand tu veux depuis
                <span className="font-bold"> Profil → Réglages → Type de compte</span>.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Ta date de naissance
            </label>
            <input
              type="date"
              value={birthDate}
              max={maxDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-1 focus:ring-purple-500 focus:outline-none dark:text-white"
            />
            <p className="text-[10px] text-gray-400 leading-snug">
              Nécessaire pour t'afficher les œuvres adaptées à ton âge. Sans elle, certaines œuvres restent masquées.
            </p>
          </div>

          {error && (
            <div className="text-[11px] p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold">
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handle}
            disabled={busy}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2"
          >
            {busy ? 'Enregistrement…' : 'Commencer à lire'}
          </button>

          <p className="text-[9px] text-gray-400 text-center leading-snug pt-0.5">
            Astuce : tu pourras aussi créer un mot de passe depuis <span className="font-bold">Profil → Réglages</span> pour te connecter par e-mail.
          </p>
        </div>
      </div>
    </div>
  );
}
