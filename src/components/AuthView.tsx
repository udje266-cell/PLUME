/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff, Sparkles, Check, KeyRound, ArrowLeft } from 'lucide-react';
import { User, UserRole } from '../types';
import { USERS } from '../data';
import { setAuthToken } from '../utils/auth';
import Logo from './Logo';

interface AuthViewProps {
  allUsers: User[];
  onLoginSuccess: (user: User) => void;
  onRegisterSuccess: (newUser: User) => void;
}

export default function AuthView({ allUsers, onLoginSuccess, onRegisterSuccess }: AuthViewProps) {
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
  const [simulatedOtp, setSimulatedOtp] = useState('');
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'Connexion impossible.');
        setIsLoading(false);
        return;
      }

      // Token gardé en mémoire (pas dans localStorage) ; le serveur a aussi posé
      // un cookie httpOnly pour la persistance après rechargement.
      setAuthToken(data.token);
      setSuccessMsg('Connexion réussie !');
      onLoginSuccess(data.user);
    } catch (error) {
      console.error(error);
      setErrorMsg('Erreur de connexion au serveur.');
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
    if (selectedDate >= today) {
      setErrorMsg('La date de naissance doit se situer dans le passé.');
      return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason: 'register' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || "Impossible d'envoyer le code OTP.");
        setIsLoading(false);
        return;
      }

      setOtpReason('register');
      setPendingUser({
        id: `user_${Date.now()}`,
        username,
        email,
        role,
        avatar: role === 'Auteur' 
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=155' 
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=155',
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
      setSuccessMsg(data.message || 'Code OTP envoyé par e-mail.');
    } catch (error) {
      console.error(error);
      setErrorMsg("Erreur de connexion au serveur d'authentification.");
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
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason: 'reset' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || "Impossible d'envoyer le code OTP.");
        setIsLoading(false);
        return;
      }

      setOtpReason('reset');
      setMode('otp');
      setSuccessMsg(data.message || 'Code OTP envoyé par e-mail.');
    } catch (error) {
      console.error(error);
      setErrorMsg("Erreur de connexion au serveur d'authentification.");
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
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, code: verifiedOtpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'Réinitialisation impossible.');
        setIsLoading(false);
        return;
      }

      setPassword('');
      setVerifiedOtpCode('');
      setOtpCode(['', '', '', '', '', '']);
      setMode('login');
      setSuccessMsg('Votre mot de passe a été réinitialisé. Vous pouvez vous connecter.');
    } catch (error) {
      console.error(error);
      setErrorMsg('Erreur de connexion au serveur.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. OTP Verification Handling
  const handleVerifyOtp = async () => {
    const codeEntered = otpCode.join('');
    setErrorMsg('');

    if (codeEntered.length < 6) {
      setErrorMsg('Veuillez entrer le code de sécurité à 6 chiffres entier.');
      return;
    }

    setIsLoading(true);

    try {
      if (otpReason === 'register' && pendingUser) {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pendingUser, password, code: codeEntered }),
        });

        const data = await response.json();

        if (!response.ok) {
          setErrorMsg(data.error || 'Inscription impossible.');
          setIsLoading(false);
          return;
        }

        // Token gardé en mémoire (pas dans localStorage) ; cookie httpOnly posé
        // par le serveur pour la persistance après rechargement.
        setAuthToken(data.token);
        setSuccessMsg('Votre compte Plume a été créé et activé avec succès !');
        onRegisterSuccess(data.user);
      } else {
        setVerifiedOtpCode(codeEntered);
        setPassword('');
        setOtpCode(['', '', '', '', '', '']);
        setMode('new-password');
        setSuccessMsg('Code renseigné. Choisissez maintenant un nouveau mot de passe.');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Erreur de connexion au serveur.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason: otpReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || "Impossible de renvoyer le code OTP.");
      } else {
        setSuccessMsg(data.message || 'Nouveau code OTP envoyé par e-mail.');
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Erreur lors de la connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, idx: number) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otpCode];
    newOtp[idx] = value.substring(value.length - 1);
    setOtpCode(newOtp);

    // Auto-focus next input element
    if (value && idx < 5) {
      const nextInput = document.getElementById(`otp-input-${idx + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
      const prevInput = document.getElementById(`otp-input-${idx - 1}`);
      prevInput?.focus();
    }
  };

  // Fast demo-bypass
  const handleQuickDemoAccess = async (userEmail: string) => {
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    // On cherche le compte de démo dans les données seed (qui contiennent les
    // emails) : la liste allUsers ne renvoie plus les emails des autres comptes.
    const target = USERS.find(u => u.email === userEmail) || allUsers.find(u => u.email === userEmail);
    if (!target) {
      setErrorMsg('Compte de démonstration introuvable.');
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: target.email,
          username: target.username,
          role: target.role,
          avatar: target.avatar,
          bio: target.bio,
          birthDate: target.birthDate,
          gender: target.gender,
          favoriteGenres: target.favoriteGenres,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error || 'Connexion démo impossible.');
        setIsLoading(false);
        return;
      }

      // Token gardé en mémoire (pas dans localStorage) ; cookie httpOnly posé
      // par le serveur pour la persistance après rechargement.
      setAuthToken(data.token);
      setSuccessMsg('Connexion démo réussie !');
      onLoginSuccess(data.user);
    } catch (error) {
      console.error(error);
      setErrorMsg('Erreur lors de la connexion au serveur.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] py-8 px-6 animate-fade-in text-gray-900 dark:text-gray-100">
      
      {/* Brand Launcher Block */}
      <div className="text-center mb-8">
        <div className="flex justify-center items-center mb-2">
          <Logo size="2xl" showText={true} />
        </div>
        <p className="text-xs text-paragraph-muted text-gray-500 dark:text-zinc-400 font-sans tracking-wide">
          Découvrez, écrivez et épanouissez votre imaginaire francophone.
        </p>
      </div>

      {/* Main card panel */}
      <div className="w-full max-w-sm bg-white dark:bg-[#0E0E14] border border-gray-150 dark:border-purple-900/15 rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300">
        
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
                <div className="text-[10px] p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-650 dark:text-purple-400 rounded-xl font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-[10px] p-2.5 bg-purple-600/10 border border-purple-900/15 text-purple-600 dark:text-purple-400 rounded-xl font-bold">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 transform hover:scale-[1.01] hover:shadow-lg hover:shadow-purple-500/10 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>S'authentifier</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

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
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 caractères (lettre + chiffre)"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Date de naissance</label>
                <input
                  type="date"
                  required
                  value={birthDate}
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
                <div className="text-[10px] p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-650 dark:text-purple-400 rounded-xl font-bold">
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
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="text-[10px] p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-650 dark:text-purple-400 rounded-xl font-bold">
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
                <div className="text-[10px] p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-650 dark:text-purple-400 rounded-xl font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-[10px] p-2.5 bg-purple-600/10 border border-purple-900/15 text-purple-600 dark:text-purple-400 rounded-xl font-bold">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-60"
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
                    maxLength={1}
                    value={digit}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    className="w-10 h-11 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-center text-sm font-black focus:ring-1 focus:ring-purple-505 focus:outline-hidden"
                  />
                ))}
              </div>

              {errorMsg && (
                <div className="text-[10px] p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-650 dark:text-purple-400 rounded-xl font-bold text-center">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-[10px] p-2.5 bg-purple-600/10 border border-purple-900/15 text-purple-600 dark:text-purple-400 rounded-xl font-bold text-center">
                  {successMsg}
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                className="w-full py-2.5 bg-[#7C3AED] hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer"
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
            </div>
          </div>
        )}
      </div>

      {/* QUICK SELECT PROFILE UTILITY IN FOOTER */}
      <div className="mt-8 p-4 w-full max-w-sm bg-gray-50 dark:bg-zinc-900/60 border border-gray-150 dark:border-zinc-800/40 rounded-xl">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-[#7C3AED] dark:text-purple-400 mb-2.5 text-center">
          Accès instantané (Comptes de test)
        </h4>
        <div className="grid grid-cols-2 gap-2 text-center text-[9px] font-bold">
          <button
            onClick={() => handleQuickDemoAccess('charlotte@plume.fr')}
            className="p-1 px-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-lg hover:border-purple-500 transition line-clamp-1 cursor-pointer"
          >
            Charlotte (@Charlotte_B)
          </button>
          <button
            onClick={() => handleQuickDemoAccess('alexandre@plume.fr')}
            className="p-1 px-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-lg hover:border-purple-500 transition line-clamp-1 cursor-pointer"
          >
            Alexandre (@Alexandre_Dumas)
          </button>
          <button
            onClick={() => handleQuickDemoAccess('sophie.lefevre@plume.fr')}
            className="p-1 px-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 rounded-lg hover:border-purple-500 transition line-clamp-1 col-span-2 cursor-pointer"
          >
            Sophie (@Sophie_L - Lit et Écrit)
          </button>
          <button
            onClick={() => handleQuickDemoAccess('gaby.mod@plume.fr')}
            className="p-1 px-2.5 bg-gradient-to-r from-purple-500/10 to-violet-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg hover:border-purple-500 transition col-span-2 cursor-pointer"
          >
            Gabriel (@Gabriel_Plume_Mod)
          </button>
        </div>
      </div>
    </div>
  );
}
