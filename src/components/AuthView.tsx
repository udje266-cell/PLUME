/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff, Sparkles, Check, KeyRound, ArrowLeft, Feather, BookOpen, PenTool, Users } from 'lucide-react';
import { User } from '../types';
import { setAuthToken } from '../utils/auth';
import { apiPost } from '../utils/api';
import Logo from './Logo';
import GoogleSignInButton from './GoogleSignInButton';

// La connexion Google n'apparaît que si un Client ID est configuré au build.
const GOOGLE_ENABLED = !!(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);

interface AuthViewProps {
  onLoginSuccess: (user: User) => void;
  onRegisterSuccess: (newUser: User) => void;
}

// Avatar par défaut LOCAL (SVG embarqué) : toujours affichable, contrairement aux
// anciennes URLs Unsplash qui pouvaient ne pas charger (réseau / CORS).
function defaultAvatarFor(name: string): string {
  const initial = (name.trim()[0] || 'P').toUpperCase();
  const palettes = [['#7c3aed', '#c084fc'], ['#2563eb', '#60a5fa'], ['#db2777', '#f9a8d4'], ['#059669', '#6ee7b7']];
  const idx = (initial.charCodeAt(0) || 0) % palettes.length;
  const [c1, c2] = palettes[idx];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><text x="80" y="80" dy="0.36em" text-anchor="middle" font-family="Inter, sans-serif" font-size="78" font-weight="700" fill="#ffffff">${initial}</text></svg>`;
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return `data:image/svg+xml;base64,${window.btoa(svg)}`;
  }
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function AuthView({ onLoginSuccess, onRegisterSuccess }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'otp' | 'new-password'>('login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'Homme' | 'Femme'>('Homme');
  const [role, setRole] = useState<'Lecteur' | 'Auteur'>('Lecteur');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  
  // OTP related states
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpReason, setOtpReason] = useState<'register' | 'reset'>('register');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [verifiedOtpCode, setVerifiedOtpCode] = useState('');

  // Styling & visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Genre Options
  const GENRE_OPTIONS = [
    'Science-Fiction',
    'Thriller & Policier',
    'Romance',
    'Fantasy',
    'Drame',
    'Poésie'
  ];

  const handleToggleGenre = (genre: string) => {
    if (favoriteGenres.includes(genre)) {
      setFavoriteGenres(favoriteGenres.filter(g => g !== genre));
    } else {
      setFavoriteGenres([...favoriteGenres, genre]);
    }
  };

  // 1. Connection (Login) Action
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('Veuillez remplir tous les champs requis.');
      return;
    }

    setIsLoading(true);

    try {
      // E-mail nettoyé (espaces + casse) : un espace résiduel ne doit pas faire
      // échouer une connexion pourtant valide.
      const data = await apiPost('/api/auth/login', { email: email.trim().toLowerCase(), password }, 45000);
      // Token gardé en mémoire (pas dans localStorage) ; le serveur a aussi posé
      // un cookie httpOnly pour la persistance après rechargement.
      setAuthToken(data.token);
      setSuccessMsg('Connexion réussie !');
      onLoginSuccess(data.user);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || 'Connexion impossible.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Pre-Registration to trigger OTP
  const handlePreRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username || !email || !password || !birthDate) {
      setErrorMsg('Veuillez remplir toutes les informations, y compris la date de naissance.');
      return;
    }

    // Validate if birthDate is a reasonable past date
    const selectedDate = new Date(birthDate);
    const today = new Date();
    if (isNaN(selectedDate.getTime()) || selectedDate >= today) {
      setErrorMsg('La date de naissance doit se situer dans le passé.');
      return;
    }

    // Âge minimum : 13 ans (garde-fou cohérent avec les classifications de contenu).
    const ageYears = (today.getTime() - selectedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 13) {
      setErrorMsg('Vous devez avoir au moins 13 ans pour créer un compte.');
      return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    setIsLoading(true);

    try {
      const data = await apiPost('/api/auth/otp/request', { email: cleanEmail, reason: 'register' }, 45000);

      setOtpReason('register');
      setPendingUser({
        username,
        email: cleanEmail,
        role,
        // Avatar par défaut LOCAL (toujours affichable). L'id est généré par le serveur.
        avatar: defaultAvatarFor(username),
        bio: `Nouvelle plume littéraire. Explorant les archipels de la pensée.`,
        followers: [],
        following: [],
        isVerified: false,
        signUpDate: new Date().toISOString().split('T')[0],
        favoriteGenres,
        birthDate,
        gender
      });

      setMode('otp');
      // Repli : le serveur renvoie le code directement quand l'e-mail n'a pas pu
      // partir (service non configuré, OU compte Brevo neuf encore restreint,
      // quota…). On pré-remplit les 6 cases pour que l'inscription aboutisse
      // quand même — l'envoi par e-mail redeviendra la norme une fois Brevo prêt.
      if (typeof data.devCode === 'string' && /^\d{6}$/.test(data.devCode)) {
        setOtpCode(data.devCode.split(''));
        setSuccessMsg(data.emailError
          ? "L'e-mail n'a pas pu être envoyé : code pré-rempli, touchez « Vérifier le Code »."
          : 'Code de validation pré-rempli. Touchez « Vérifier le Code ».');
      } else {
        setSuccessMsg(data.message || 'Code OTP envoyé par e-mail.');
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || "Impossible d'envoyer le code OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Password Reset Trigger to OTP
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email) {
      setErrorMsg('Veuillez saisir votre adresse e-mail.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiPost('/api/auth/otp/request', { email: email.trim().toLowerCase(), reason: 'reset' }, 45000);
      setOtpReason('reset');
      setMode('otp');
      setSuccessMsg(data.message || 'Code OTP envoyé par e-mail.');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || "Impossible d'envoyer le code OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3b. Save the new password after OTP validation
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!password || password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.');
      return;
    }

    setIsLoading(true);

    try {
      await apiPost('/api/auth/reset-password', { email: email.trim().toLowerCase(), password, code: verifiedOtpCode }, 45000);

      setPassword('');
      setVerifiedOtpCode('');
      setOtpCode(['', '', '', '', '', '']);
      setMode('login');
      setSuccessMsg('Votre mot de passe a été réinitialisé. Vous pouvez vous connecter.');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || 'Réinitialisation impossible.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. OTP Verification Handling
  const handleVerifyOtp = async (codeOverride?: string) => {
    const codeEntered = codeOverride ?? otpCode.join('');
    setErrorMsg('');

    if (codeEntered.length < 6) {
      setErrorMsg('Veuillez entrer le code de sécurité à 6 chiffres entier.');
      return;
    }

    setIsLoading(true);

    try {
      if (otpReason === 'register' && pendingUser) {
        const data = await apiPost('/api/auth/register', { ...pendingUser, password, code: codeEntered }, 45000);

        // Token gardé en mémoire (pas dans localStorage) ; cookie httpOnly posé
        // par le serveur pour la persistance après rechargement.
        setAuthToken(data.token);
        setSuccessMsg('Votre compte Plume a été créé et activé avec succès !');
        onRegisterSuccess(data.user);
      } else {
        // Réinitialisation : on VÉRIFIE le code côté serveur AVANT de passer à
        // l'écran du nouveau mot de passe (un code faux est détecté tout de suite,
        // sans consommer l'OTP — il sera consommé à l'étape finale).
        await apiPost('/api/auth/verify-otp', { email: email.trim().toLowerCase(), code: codeEntered }, 45000);
        setVerifiedOtpCode(codeEntered);
        setPassword('');
        setOtpCode(['', '', '', '', '', '']);
        setMode('new-password');
        setSuccessMsg('Code validé. Choisissez maintenant un nouveau mot de passe.');
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || (otpReason === 'register' ? 'Inscription impossible.' : 'Code invalide ou expiré.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    try {
      const data = await apiPost('/api/auth/otp/request', { email: email.trim().toLowerCase(), reason: otpReason }, 45000);
      setSuccessMsg(data.message || 'Nouveau code OTP envoyé par e-mail.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message || "Impossible de renvoyer le code OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // Distribue une suite de chiffres (saisie OU collage) à partir d'une case.
  const fillOtpFrom = (digits: string, startIdx: number) => {
    const clean = digits.replace(/\D/g, '');
    if (!clean) return;
    const newOtp = [...otpCode];
    let i = startIdx;
    for (const ch of clean) {
      if (i > 5) break;
      newOtp[i] = ch;
      i++;
    }
    setOtpCode(newOtp);
    // Focus la prochaine case vide (ou la dernière remplie).
    const nextIdx = Math.min(i, 5);
    document.getElementById(`otp-input-${nextIdx}`)?.focus();
    // Auto-validation dès que les 6 chiffres sont saisis.
    const joined = newOtp.join('');
    if (joined.length === 6 && !newOtp.includes('')) {
      handleVerifyOtp(joined);
    }
  };

  const handleOtpChange = (value: string, idx: number) => {
    if (value === '') {
      const newOtp = [...otpCode];
      newOtp[idx] = '';
      setOtpCode(newOtp);
      return;
    }
    // Collage d'un code complet dans une case → réparti sur les suivantes.
    if (value.length > 1) {
      fillOtpFrom(value, idx);
      return;
    }
    if (isNaN(Number(value))) return;
    fillOtpFrom(value, idx);
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>, idx: number) => {
    const pasted = e.clipboardData.getData('text');
    if (/\d/.test(pasted)) {
      e.preventDefault();
      fillOtpFrom(pasted, idx);
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
      const prevInput = document.getElementById(`otp-input-${idx - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 animate-fade-in text-gray-900 dark:text-gray-100">

      {/* Panneau de MARQUE (DESKTOP >= lg) — facon page de connexion de site web,
          inspire du modele fourni (visuel + accroche + badge), aux couleurs de
          PLUME (degrade violet -> fuchsia sur fond sombre de l'appli). */}
      <div className="hidden lg:flex flex-col justify-between gap-8 px-14 py-12 bg-gradient-to-br from-[#0E0E14] via-purple-800 to-fuchsia-600 text-white relative overflow-hidden">
        {/* Halos lumineux */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-fuchsia-400/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-24 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />

        {/* Zone LOGO : le VRAI logo PLUME (plume + wordmark), variante claire. */}
        <div className="relative z-10">
          <Logo onDark size="sm" />
        </div>

        {/* Accroche promotionnelle (facon « 50% OFF »), adaptee a PLUME. */}
        <div className="relative z-10 space-y-4 max-w-md">
          <div>
            <p className="font-serif font-black text-5xl leading-none tracking-tight drop-shadow-sm">100% gratuit</p>
            <p className="font-serif font-black text-3xl leading-tight text-white/90 mt-1">pour lire &amp; écrire</p>
          </div>
          <p className="text-white/80 text-sm leading-relaxed">
            Des milliers de récits à dévorer, un atelier pour écrire les vôtres, et une communauté de lecteurs et d'auteurs. Votre imaginaire prend vie.
          </p>

          {/* Illustration on-brand : livre ouvert + plume + étoiles (trait clair,
              esprit du visuel du modèle). */}
          <div className="py-2">
            <svg viewBox="0 0 320 170" className="w-full max-w-sm h-auto text-white/85" fill="none" aria-hidden="true">
              <path d="M40 118c40-16 80-16 120 0 40-16 80-16 120 0V64c-40-16-80-16-120 0-40-16-80-16-120 0v54Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
              <path d="M160 64v54" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M64 78c22-7 44-7 72 4M64 92c22-7 44-7 72 4M184 82c22-11 44-11 72-4M184 96c22-11 44-11 72-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7"/>
              {/* Plume qui écrit */}
              <path d="M232 40c-26 6-44 22-52 44 14-2 30-8 42-22 8-9 11-16 10-22Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
              <path d="M180 92l16-16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              {/* Étoiles */}
              <path d="M96 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="currentColor" opacity="0.9"/>
              <path d="M280 112l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="currentColor" opacity="0.8"/>
              <circle cx="52" cy="150" r="2.5" fill="currentColor" opacity="0.6"/>
              <circle cx="268" cy="52" r="2.5" fill="currentColor" opacity="0.6"/>
            </svg>
          </div>
        </div>

        {/* Bandeau « avantage » facon coupon du modele. */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Nouveau ?</span>
          <span className="inline-flex items-center gap-2 bg-white text-purple-700 font-black text-sm px-4 py-2 rounded-xl shadow-lg tracking-wide">
            <Feather className="w-4 h-4" /> INSCRIPTION OFFERTE
          </span>
        </div>
      </div>

      {/* Colonne du FORMULAIRE (centre) */}
      <div className="flex flex-col items-center justify-center min-h-[90vh] lg:min-h-screen py-8 px-6">

      {/* Brand Launcher Block — masque sur desktop (le panneau de gauche marque
          deja PLUME) pour un formulaire epure facon site web. */}
      <div className="text-center mb-8 lg:hidden">
        <div className="flex justify-center items-center mb-2">
          <Logo size="2xl" showText={true} />
        </div>
        <p className="text-xs text-paragraph-muted text-gray-500 dark:text-zinc-400 font-sans tracking-wide">
          Lisez, écrivez, partagez — votre imaginaire prend vie.
        </p>
      </div>

      {/* Main card panel. Sur desktop : plus large, plus aere, champs et titres
          agrandis (variantes lg: ciblant les input/h2/label descendants) pour un
          vrai rendu web ; sur mobile, la carte compacte reste identique. */}
      <div className="w-full max-w-sm lg:max-w-[440px] bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-2xl lg:rounded-3xl p-6 lg:p-10 shadow-xl lg:shadow-2xl relative overflow-hidden transition-all duration-300 lg:[&_input]:py-3.5 lg:[&_input]:text-sm lg:[&_h2]:text-2xl lg:[&_label]:text-[11px]">
        
        {/* Decorative Top Accent line */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-purple-600 to-violet-850" />

        {/* Global Loading screen */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 z-50 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-purple-600 animate-spin" />
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#7C3AED]">Traitement en cours</p>
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {mode === 'login' && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center">
              <h2 className="text-xl font-black tracking-tight text-gray-905 dark:text-white">Heureux de vous revoir !</h2>
              <p className="text-[11px] text-gray-400 mt-1">Saisissez vos accès pour reprendre vos lectures.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Adresse E-mail</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mot de Passe</label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setMode('forgot');
                    }}
                    className="text-[9px] font-extrabold text-[#7C3AED] dark:text-purple-400 hover:underline"
                  >
                    Oublié ?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="text-[10px] p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-[10px] p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 lg:py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs lg:text-sm font-black uppercase tracking-wider transition-all duration-300 transform hover:scale-[1.01] hover:shadow-lg hover:shadow-purple-500/10 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>S'authentifier</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {GOOGLE_ENABLED && (
              <>
                <div className="flex items-center gap-3 py-0.5">
                  <span className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
                  <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">ou</span>
                  <span className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
                </div>
                <GoogleSignInButton
                  text="signin_with"
                  onLoadingChange={setIsLoading}
                  onError={(m) => setErrorMsg(m)}
                  onSuccess={(user, token) => { setAuthToken(token); onLoginSuccess(user); }}
                />
              </>
            )}

            <div className="pt-2 text-center">
              <p className="text-[10px] text-gray-400">
                Nouveau membre sur Plume ?{' '}
                <button
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setMode('register');
                  }}
                  className="font-extrabold text-[#7C3AED] dark:text-purple-400 hover:underline"
                >
                  S'inscrire gratuitement
                </button>
              </p>
            </div>
          </div>
        )}

        {/* 2. REGISTRATION MODE */}
        {mode === 'register' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <h2 className="text-xl font-black tracking-tight text-gray-905 dark:text-white">Créer mon profil</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Rejoignez l'archipel des conteurs francophones.</p>
            </div>

            <form onSubmit={handlePreRegister} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Nom de plume</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Alex_Plume_21"
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">E-mail de contact</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@plume.ovh"
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 font-sans">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="new-password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 caractères (lettre + chiffre)"
                    className="w-full px-3 pr-10 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Date de naissance</label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden text-gray-700 dark:text-gray-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Genre</label>
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  {(['Homme', 'Femme'] as const).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setGender(g)}
                      className={`py-1.5 rounded-lg text-[9px] font-black uppercase transition-all tracking-wider ${
                        gender === g
                          ? 'bg-purple-600 text-white shadow'
                          : 'bg-gray-50 dark:bg-zinc-900 text-gray-500 border border-gray-200 dark:border-zinc-800'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Type d'affinité</label>
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  {(['Lecteur', 'Auteur'] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setRole(r)}
                      className={`py-1.5 rounded-lg text-[9px] font-black uppercase transition-all tracking-wider ${
                        role === r
                          ? 'bg-purple-600 text-white shadow'
                          : 'bg-gray-50 dark:bg-zinc-900 text-gray-500 border border-gray-200 dark:border-zinc-800'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag/Genres choices */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Genres d'intérêt (Options)</label>
                <div className="flex flex-wrap gap-1">
                  {GENRE_OPTIONS.map((g) => {
                    const isSel = favoriteGenres.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => handleToggleGenre(g)}
                        className={`text-[8px] px-2 py-0.5 rounded-md font-bold transition-all border ${
                          isSel
                            ? 'bg-purple-600/15 text-purple-600 dark:text-purple-300 border-purple-500/30'
                            : 'bg-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border-gray-200 dark:border-[#2a2a35]'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <div className="text-[10px] p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>Créer mon compte</span>
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </form>

            {GOOGLE_ENABLED && (
              <>
                <div className="flex items-center gap-3 py-0.5">
                  <span className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
                  <span className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">ou</span>
                  <span className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
                </div>
                <GoogleSignInButton
                  text="signup_with"
                  onLoadingChange={setIsLoading}
                  onError={(m) => setErrorMsg(m)}
                  onSuccess={(user, token) => { setAuthToken(token); onRegisterSuccess(user); }}
                />
                <p className="text-[9px] text-gray-400 text-center leading-snug">
                  En un clic, sans mot de passe. Ton compte est créé automatiquement.
                </p>
              </>
            )}

            <div className="pt-1 text-center">
              <button
                onClick={() => {
                  setErrorMsg('');
                  setMode('login');
                }}
                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-white flex items-center justify-center space-x-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Déjà membre ? Se connecter</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. FORGOT PASSWORD MODE */}
        {mode === 'forgot' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <h2 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">Mot de passe oublié</h2>
              <p className="text-[11px] text-gray-400 mt-1 leading-normal">
                Nous allons vous envoyer un code OTP de secours pour vérifier votre identité.
              </p>
            </div>

            <form onSubmit={handleRequestPasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Saisissez votre e-mail</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="text-[10px] p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-violet-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>Envoyer le code OTP</span>
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="pt-1 text-center">
              <button
                onClick={() => {
                  setErrorMsg('');
                  setMode('login');
                }}
                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-white flex items-center justify-center space-x-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour au formulaire</span>
              </button>
            </div>
          </div>
        )}

        {/* 3b. NEW PASSWORD MODE */}
        {mode === 'new-password' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <h2 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">Nouveau mot de passe</h2>
              <p className="text-[11px] text-gray-400 mt-1 leading-normal">
                Votre code OTP est validé. Créez maintenant un nouveau mot de passe.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nouveau mot de passe</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="new-password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères (lettre + chiffre)"
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="text-[10px] p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-[10px] p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 lg:py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs lg:text-sm font-black uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}</span>
                <Check className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-1 text-center">
              <button
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setPassword('');
                  setMode('login');
                }}
                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-white flex items-center justify-center space-x-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à la connexion</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. OTP DOUBLE-FACTOR CONFIRMATION MODE */}
        {mode === 'otp' && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center">
              <div className="inline-flex p-3 rounded-full bg-purple-500/10 text-purple-600 mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-gray-905 dark:text-white animate-pulse">Code OTP Secret</h2>
              <p className="text-[11px] text-gray-400 mt-1 leading-normal">
                Saisissez le code de validation reçu à <span className="font-extrabold text-gray-600 dark:text-zinc-200">{email}</span>.
              </p>
            </div>

            {/* In-app visual simulation feedback helper */}
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/50 rounded-xl text-center">
              <p className="text-[9px] font-mono leading-relaxed text-[#7C3AED] dark:text-indigo-300">
                📬 [E-mail envoyé]<br />
                Saisissez le code de validation à 6 chiffres reçu par e-mail.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-center items-center space-x-2">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={digit}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    onPaste={(e) => handleOtpPaste(e, idx)}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    className="w-10 h-11 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-center text-sm font-black focus:ring-1 focus:ring-purple-505 focus:outline-hidden"
                  />
                ))}
              </div>

              {errorMsg && (
                <div className="text-[10px] p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-center">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-[10px] p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-center">
                  {successMsg}
                </div>
              )}

              <button
                onClick={() => handleVerifyOtp()}
                disabled={isLoading}
                className="w-full py-2.5 bg-[#7C3AED] hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-60"
              >
                <span>Vérifier le Code</span>
                <Check className="w-4 h-4" />
              </button>

              <button
                onClick={handleResendOtp}
                className="w-full text-center text-[9px] font-black uppercase text-gray-400 hover:text-purple-600 transition"
              >
                Renvoyer le code OTP
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpCode(['', '', '', '', '', '']);
                  setErrorMsg('');
                  setSuccessMsg('');
                  // Retour vers l'étape précédente selon le contexte OTP.
                  setMode(otpReason === 'reset' ? 'forgot' : 'register');
                }}
                className="w-full flex items-center justify-center space-x-1 text-[11px] font-bold text-gray-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition pt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{otpReason === 'reset' ? "Modifier l'adresse e-mail" : "Retour à l'inscription"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liens légaux (requis stores) */}
      <p className="mt-5 text-[9px] text-gray-400 dark:text-zinc-500 text-center">
        En continuant, vous acceptez nos{' '}
        <a href="/terms.html" target="_blank" rel="noreferrer" className="underline hover:text-purple-600 dark:hover:text-purple-400">Conditions d'utilisation</a>
        {' '}et notre{' '}
        <a href="/privacy.html" target="_blank" rel="noreferrer" className="underline hover:text-purple-600 dark:hover:text-purple-400">Politique de confidentialité</a>.
      </p>
      </div>
    </div>
  );
}
