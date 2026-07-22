/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bouton « Continuer avec Google » — multi-plateforme :
 *  - WEB : Google Identity Services (bouton OFFICIEL rendu par Google) → renvoie
 *    un ID token (`credential`) échangé auprès du serveur.
 *  - NATIF (Android / iOS via Capacitor) : plugin @capgo/capacitor-social-login
 *    (SDK Google natif) → renvoie un ID token échangé de la même façon.
 * Le serveur (/api/auth/google) VÉRIFIE le token et ouvre la session. Aucun mot
 * de passe Google n'est jamais manipulé côté client. Si aucun Client ID n'est
 * configuré (VITE_GOOGLE_CLIENT_ID), le bouton ne s'affiche pas.
 */

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { apiPost } from '../utils/api';

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';

declare global {
  interface Window { google?: any }
}

interface Props {
  /** Appelé après vérification serveur réussie : ouvre la session. */
  onSuccess: (user: any, token: string) => void;
  onError?: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** Libellé du bouton officiel web. */
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

// Échange l'ID token Google contre une session PLUME (vérif côté serveur).
async function exchangeGoogleToken(idToken: string): Promise<{ user: any; token: string }> {
  return apiPost('/api/auth/google', { idToken }, 45000);
}

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function GoogleSignInButton({ onSuccess, onError, onLoadingChange, text = 'continue_with' }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const run = (promise: Promise<{ user: any; token: string }>) => {
    setBusy(true);
    onLoadingChange?.(true);
    promise
      .then(({ user, token }) => onSuccess(user, token))
      .catch((e: any) => onError?.(e?.message || 'Connexion Google impossible. Réessaie.'))
      .finally(() => { setBusy(false); onLoadingChange?.(false); });
  };

  // ── WEB : rendu du bouton officiel Google Identity Services ──
  useEffect(() => {
    if (isNative || !CLIENT_ID) return;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const g = window.google;
      if (!g?.accounts?.id || !divRef.current) { setTimeout(render, 150); return; }
      try {
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp: any) => { if (resp?.credential) run(exchangeGoogleToken(resp.credential)); },
        });
        divRef.current.innerHTML = '';
        g.accounts.id.renderButton(divRef.current, {
          theme: 'outline', size: 'large', width: 320, text, shape: 'pill', logo_alignment: 'left',
        });
      } catch { /* GIS indisponible : le bouton reste vide */ }
    };
    render();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  // ── NATIF : connexion via le SDK Google natif (plugin Capacitor) ──
  const nativeLogin = async (): Promise<{ user: any; token: string }> => {
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      await SocialLogin.initialize({ google: { webClientId: CLIENT_ID } });
      // PAS de `scopes` ici : e-mail + profil sont déjà fournis via l'ID token.
      // Passer des scopes déclenche le flux « online » du plugin qui exige une
      // modification de la MainActivity (« You CANNOT use scopes without
      // modifying the main activity »). On veut juste l'ID token (mode offline).
      const res: any = await SocialLogin.login({ provider: 'google', options: {} });
      const idToken: string | undefined = res?.result?.idToken || res?.idToken;
      if (!idToken) throw new Error('Aucun jeton renvoyé par Google.');
      return await exchangeGoogleToken(idToken);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/cancel/i.test(msg) || /12501/.test(msg)) throw new Error('Connexion annulée.');
      if (/network|internet/i.test(msg)) throw new Error('Pas de connexion Internet.');
      throw new Error(msg || 'Connexion Google impossible.');
    }
  };

  // Google non configuré → on n'affiche rien (dégradation propre).
  if (!CLIENT_ID) return null;

  // NATIF : bouton conforme aux recommandations Google (fond blanc, logo « G »).
  if (isNative) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => run(nativeLogin())}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 lg:py-3 rounded-full bg-white text-[#3c4043] border border-gray-300 hover:bg-gray-50 disabled:opacity-60 font-bold text-sm shadow-sm transition"
      >
        {busy ? (
          <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#4285F4] animate-spin" />
        ) : (
          <GoogleGlyph />
        )}
        <span>{busy ? 'Connexion…' : 'Continuer avec Google'}</span>
      </button>
    );
  }

  // WEB : conteneur du bouton officiel + voile de chargement pendant l'échange.
  return (
    <div className="relative w-full flex justify-center">
      <div ref={divRef} className={busy ? 'opacity-40 pointer-events-none' : ''} />
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-[#4285F4] animate-spin" />
        </span>
      )}
    </div>
  );
}
