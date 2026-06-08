/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { prisma } from './src/server/prisma';

// Garde-fou : une promesse rejetée non gérée (ex. erreur Prisma dans un handler
// sans try/catch) ne doit jamais faire planter le process en production.
process.on('unhandledRejection', (reason) => {
  console.error('[PLUME] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[PLUME] Uncaught exception:', error);
});

const _filename = typeof import.meta !== 'undefined' && import.meta.url
  ? fileURLToPath(import.meta.url) 
  : (typeof __filename !== 'undefined' ? __filename : '');

const _dirname = typeof import.meta !== 'undefined' && import.meta.url 
  ? path.dirname(fileURLToPath(import.meta.url)) 
  : (typeof __dirname !== 'undefined' ? __dirname : '');

function parseJsonArray(value: string | null | undefined) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function roleToPrisma(role: string | undefined | null) {
  if (!role) return 'Lecteur';
  const r = role.toUpperCase();
  if (r === 'AUTEUR' || role === 'Auteur') return 'Auteur';
  if (r === 'UTILISATEUR_MIXTE' || role === 'Utilisateur Mixte') return 'Utilisateur Mixte';
  if (r === 'ADMINISTRATEUR' || role === 'Administrateur') return 'Administrateur';
  return 'Lecteur';
}

function roleFromPrisma(role: string | undefined | null) {
  if (!role) return 'Lecteur';
  const r = role.toUpperCase();
  if (r === 'AUTEUR' || role === 'Auteur') return 'Auteur';
  if (r === 'UTILISATEUR_MIXTE' || role === 'Utilisateur Mixte') return 'Utilisateur Mixte';
  if (r === 'ADMINISTRATEUR' || role === 'Administrateur') return 'Administrateur';
  return 'Lecteur';
}

function genderToPrisma(gender: string | undefined | null) {
  if (!gender) return null;
  const g = gender.toUpperCase();
  if (g === 'HOMME' || gender === 'Homme') return 'Homme';
  if (g === 'FEMME' || gender === 'Femme') return 'Femme';
  return null;
}

function genderFromPrisma(gender: string | null | undefined) {
  if (!gender) return undefined;
  const g = gender.toUpperCase();
  if (g === 'HOMME' || gender === 'Homme') return 'Homme';
  if (g === 'FEMME' || gender === 'Femme') return 'Femme';
  return undefined;
}

function storyStatusToPrisma(status: string | undefined) {
  return status === 'Publié' ? 'PUBLIE' as any : 'BROUILLON' as any;
}

function storyStatusFromPrisma(status: string | undefined) {
  return status === 'PUBLIE' ? 'Publié' : 'Brouillon';
}

function ageRatingToPrisma(ageRating: string | undefined) {
  if (ageRating === '12') return 'TWELVE' as any;
  if (ageRating === '16') return 'SIXTEEN' as any;
  if (ageRating === '18') return 'EIGHTEEN' as any;
  return 'ALL' as any;
}

function ageRatingFromPrisma(ageRating: string | undefined) {
  if (ageRating === 'TWELVE') return '12';
  if (ageRating === 'SIXTEEN') return '16';
  if (ageRating === 'EIGHTEEN') return '18';
  return 'all';
}

function validatePassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

// includePrivate : n'inclure email/birthDate (données personnelles) que pour
// l'utilisateur lui-même ou un administrateur. Par défaut elles sont masquées
// afin de ne pas fuiter sur les routes publiques (listes, profils d'autrui…).
function serializeUser(user: any, includePrivate = false) {
  if (!user) return user;
  const followers = Array.isArray(user.followers) ? user.followers.map((f: any) => f.followerId || f.id || f) : [];
  const following = Array.isArray(user.following) ? user.following.map((f: any) => f.followingId || f.id || f) : [];
  const blockedUsers = Array.isArray(user.blockedUsers) ? user.blockedUsers.map((b: any) => b.blockedId || b.id || b) : [];
  const { passwordHash, email, birthDate, ...safeUser } = user;
  const result: any = {
    ...safeUser,
    role: roleFromPrisma(user.role),
    gender: genderFromPrisma(user.gender),
    avatar: user.avatar || '',
    bio: user.bio || '',
    favoriteGenres: parseJsonArray(user.favoriteGenres),
    followers,
    following,
    blockedUsers,
    signUpDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : undefined,
  };
  if (includePrivate) {
    result.email = email;
    result.birthDate = birthDate ? new Date(birthDate).toISOString().split('T')[0] : undefined;
  }
  return result;
}

function serializeChapter(chapter: any) {
  if (!chapter) return chapter;
  return {
    ...chapter,
    publishDate: chapter.publishedAt ? new Date(chapter.publishedAt).toISOString().split('T')[0] : undefined,
  };
}

function serializeStory(story: any) {
  if (!story) return story;
  const author = story.author ? serializeUser(story.author) : null;
  return {
    ...story,
    tags: parseJsonArray(story.tags),
    status: storyStatusFromPrisma(story.status),
    ageRating: ageRatingFromPrisma(story.ageRating),
    publishDate: story.publishedAt ? new Date(story.publishedAt).toISOString().split('T')[0] : undefined,
    chapters: Array.isArray(story.chapters) ? story.chapters.map(serializeChapter) : [],
    author,
    authorName: author?.username || story.authorName || '',
    authorAvatar: author?.avatar || story.authorAvatar || '',
    authorVerified: Boolean(author?.isVerified),
    likes: Array.isArray(story.likes) ? story.likes.length : (story.likes ?? 0),
    favoritesCount: Array.isArray(story.favorites) ? story.favorites.length : (story.favoritesCount ?? 0),
  };
}

function serializeComment(comment: any) {
  if (!comment) return comment;
  const user = comment.user ? serializeUser(comment.user) : null;
  return {
    ...comment,
    username: user?.username || comment.username || '',
    avatar: user?.avatar || comment.avatar || '',
    date: comment.createdAt ? new Date(comment.createdAt).toISOString() : undefined,
    replies: Array.isArray(comment.replies)
      ? comment.replies.map((reply: any) => {
          const replyUser = reply.user ? serializeUser(reply.user) : null;
          return {
            ...reply,
            username: replyUser?.username || '',
            avatar: replyUser?.avatar || '',
            date: reply.createdAt ? new Date(reply.createdAt).toISOString() : undefined,
          };
        })
      : [],
  };
}

export async function createServerInstance() {
  const app = express();
  // Nécessaire pour obtenir la vraie IP client derrière un proxy (Render, etc.)
  app.set('trust proxy', 1);
  const httpServer = createServer(app);

  // Liste blanche d'origines CORS (séparées par des virgules). En production, on
  // refuse les origines inconnues ; en développement on autorise tout.
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const corsOrigin: any =
    allowedOrigins.length > 0
      ? allowedOrigins
      : process.env.NODE_ENV === 'production'
        ? false
        : '*';

  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'] },
  });
  const PORT = Number(process.env.PORT || 3000);
  const JWT_SECRET = process.env.JWT_SECRET || 'plume_secret_dev_change_later';

  // En production, le secret JWT est obligatoire : sans cela n'importe qui
  // pourrait forger des tokens valides avec la valeur par défaut publique.
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)
  ) {
    throw new Error(
      'JWT_SECRET manquant ou trop court en production (16 caractères minimum requis).'
    );
  }

  // Email configuration (used for sender extraction)
  const smtpFrom = process.env.SMTP_FROM || '"PLUME" <udje266@gmail.com>';

  async function sendOtpEmail(email: string, code: string, reason: 'register' | 'reset') {
    const subject = reason === 'register' 
      ? 'PLUME - Création de votre compte' 
      : 'PLUME - Réinitialisation de votre mot de passe';
    
    const reasonText = reason === 'register'
      ? "Pour finaliser votre inscription sur la plateforme littéraire PLUME, veuillez utiliser le code de validation à 6 chiffres ci-dessous :"
      : "Nous avons reçu une demande de réinitialisation de votre mot de passe PLUME. Veuillez utiliser le code de validation à 6 chiffres ci-dessous pour continuer :";

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #7c3aed; text-align: center;">PLUME</h2>
          <p>Bonjour,</p>
          <p>${reasonText}</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 10px 20px; background-color: #f3f4f6; border-radius: 4px; border: 1px dashed #7c3aed; color: #111827;">
              ${code}
            </span>
          </div>
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 40px;">
            Ce code est valide pendant 10 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
          </p>
        </div>
    `;

    const brevoApiKey = process.env.BREVO_API_KEY || '';

    if (!brevoApiKey) {
      console.warn(`[PLUME EMAIL] Configuration BREVO_API_KEY manquante. OTP pour ${email} : ${code} (Simulation)`);
      return true;
    }

    let senderName = "PLUME";
    let senderEmail = "udje266@gmail.com";
    const match = smtpFrom.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
    if (match) {
      senderName = match[1]?.trim() || "PLUME";
      senderEmail = match[2]?.trim();
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: senderName,
            email: senderEmail
          },
          to: [
            {
              email: email
            }
          ],
          subject: subject,
          htmlContent: htmlContent
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status} : ${errorText}`);
      }

      console.log(`[PLUME EMAIL] OTP envoyé avec succès à ${email}`);
      return true;
    } catch (error: any) {
      console.error("[PLUME EMAIL] Erreur Brevo lors de l'envoi d'e-mail :", error?.message || error);
      console.warn(`[PLUME EMAIL] Échec envoi, OTP pour ${email} : ${code}`);
      return process.env.NODE_ENV !== 'production';
    }
  }

  app.use(express.json({ limit: '10mb' }));

  // ── Rate limiting simple en mémoire (par IP) ───────────────────────────────
  // Protège les routes sensibles (login, OTP, reset) contre le brute-force et le
  // spam. Note : en mémoire uniquement — pour du multi-instance, utiliser Redis.
  function createRateLimiter(opts: { windowMs: number; max: number; message?: string }) {
    const hits = new Map<string, { count: number; resetAt: number }>();
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of hits) {
        if (value.resetAt <= now) hits.delete(key);
      }
    }, opts.windowMs);
    if (typeof cleanup.unref === 'function') cleanup.unref();

    return (req: any, res: any, next: any) => {
      // Désactivé en test pour ne pas rendre les tests flaky.
      if (process.env.NODE_ENV === 'test') return next();
      const key = req.ip || req.connection?.remoteAddress || 'unknown';
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + opts.windowMs });
        return next();
      }
      entry.count += 1;
      if (entry.count > opts.max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: opts.message || 'Trop de requêtes, veuillez réessayer plus tard.',
        });
      }
      return next();
    };
  }

  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Trop de tentatives. Réessayez dans quelques minutes.',
  });
  const otpLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Trop de demandes de code. Réessayez dans quelques minutes.",
  });

  function createToken(userId: string) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  }

  const AUTH_COOKIE = 'plume_token';
  const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 jours

  // Pose le JWT dans un cookie httpOnly : inaccessible au JavaScript (donc non
  // volable via XSS), contrairement à un stockage localStorage.
  function setAuthCookie(res: any, token: string) {
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: '/',
    });
  }

  function clearAuthCookie(res: any) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
  }

  // Lit le token depuis l'en-tête Authorization (clients cross-origin / mobile)
  // ou, à défaut, depuis le cookie httpOnly (application web same-origin).
  function getTokenFromRequest(req: any): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const headerToken = authHeader.slice('Bearer '.length).trim();
      if (headerToken) return headerToken;
    }
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const found = cookieHeader
        .split(';')
        .map((c: string) => c.trim())
        .find((c: string) => c.startsWith(`${AUTH_COOKIE}=`));
      if (found) return decodeURIComponent(found.slice(AUTH_COOKIE.length + 1));
    }
    return null;
  }

  async function requireAuth(req: any, res: any, next: any) {
    try {
      const token = getTokenFromRequest(req);
      if (!token) {
        return res.status(401).json({ error: 'Non connecté' });
      }
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
      req.user = user;
      next();
    } catch (err: any) {
      console.warn(`[AUTH] Echec authentification :`, err.message || err);
      return res.status(401).json({ error: 'Session invalide' });
    }
  }


  async function getUserFromAuthorizationHeader(req: any) {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return await prisma.user.findUnique({ where: { id: decoded.userId } });
    } catch {
      return null;
    }
  }

  // Authentification de la connexion WebSocket via le JWT (handshake).
  // Empêche un client anonyme d'écouter les notifications/messages d'autrui.
  io.use((socket, next) => {
    // Token via handshake.auth (clients mobiles) ou via le cookie httpOnly
    // envoyé automatiquement par le navigateur en same-origin.
    const token =
      (socket.handshake.auth && (socket.handshake.auth as any).token) ||
      (socket.handshake.query && (socket.handshake.query as any).token) ||
      getTokenFromRequest(socket.request as any);
    if (!token) return next(new Error('Authentification requise'));
    try {
      const decoded = jwt.verify(String(token), JWT_SECRET) as { userId: string };
      (socket.data as any).userId = decoded.userId;
      return next();
    } catch {
      return next(new Error('Session invalide'));
    }
  });

  io.on('connection', (socket) => {
    const authUserId = (socket.data as any).userId as string | undefined;
    console.log(`[SOCKET] utilisateur connecté - socketId: ${socket.id}`);

    // On ignore l'identifiant fourni par le client : un utilisateur ne peut
    // rejoindre que SA propre room, déduite du token vérifié.
    socket.on('join', () => {
      if (!authUserId) return;
      socket.join(`user:${authUserId}`);
      console.log(`[SOCKET] room join - userId: ${authUserId}, socketId: ${socket.id}`);
      socket.emit('joined', { userId: authUserId });
    });

    socket.on('typing', (payload: { senderId: string; receiverId: string }) => {
      if (payload?.receiverId) socket.to(`user:${payload.receiverId}`).emit('typing', payload);
    });

    socket.on('stop_typing', (payload: { senderId: string; receiverId: string }) => {
      if (payload?.receiverId) socket.to(`user:${payload.receiverId}`).emit('stop_typing', payload);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] utilisateur déconnecté - socketId: ${socket.id}`);
    });
  });

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Le serveur backend de PLUME fonctionne.', time: new Date().toISOString() });
  });

  app.get('/api/info', (_req, res) => {
    res.json({ appName: 'PLUME Platform', version: '1.0.0' });
  });

  // Auth
  app.post('/api/auth/otp/request', otpLimiter, async (req, res) => {
    try {
      const { email, reason } = req.body;
      if (!email || !reason) {
        return res.status(400).json({ error: 'Email et raison requis' });
      }

      const normalizedEmail = email.toLowerCase();

      if (reason === 'register') {
        const existingUser = await prisma.user.findFirst({ where: { email: normalizedEmail } });
        if (existingUser) {
          return res.status(400).json({ error: 'Cet e-mail est déjà associé à un compte Plume.' });
        }
      } else if (reason === 'reset') {
        const existingUser = await prisma.user.findFirst({ where: { email: normalizedEmail } });
        if (!existingUser) {
          return res.status(404).json({ error: 'Utilisateur introuvable avec cette adresse e-mail.' });
        }
      } else {
        return res.status(400).json({ error: 'Raison invalide.' });
      }

      console.log(`[OTP] Génération OTP pour ${normalizedEmail}`);
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Delete existing OTP for this email and expired OTPs globally
      await prisma.otp.deleteMany({
        where: {
          OR: [
            { email: normalizedEmail },
            { expiresAt: { lt: new Date() } }
          ]
        }
      });

      // Save OTP code BEFORE calling sendOtpEmail()
      await prisma.otp.create({
        data: {
          email: normalizedEmail,
          code,
          expiresAt,
        },
      });
      console.log(`[OTP] Sauvegarde OTP réussie pour ${normalizedEmail}`);

      const sent = await sendOtpEmail(email, code, reason);
      if (!sent) {
        return res.status(500).json({ error: "Échec de l'envoi de l'e-mail de validation." });
      }

      res.json({ message: 'Code OTP envoyé avec succès.', email });
    } catch (error) {
      console.error('[PLUME OTP] Request error:', error);
      res.status(500).json({ error: "Erreur lors de la demande d'OTP." });
    }
  });

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
      const { username, email, password, role, gender, birthDate, avatar, bio, favoriteGenres, code } = req.body;
      if (!username || !email || !password || !code) return res.status(400).json({ error: 'username, email, password et code OTP sont requis' });
      
      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.' });
      }

      const normalizedEmail = email.toLowerCase();
      const otpRecord = await prisma.otp.findUnique({
        where: { email: normalizedEmail },
      });

      if (!otpRecord) {
        console.log(`[OTP] OTP introuvable pour ${normalizedEmail}`);
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail}`);
        return res.status(400).json({ error: 'Aucun code OTP généré pour cet e-mail.' });
      }

      console.log(`[OTP] OTP trouvé pour ${normalizedEmail}`);

      if (otpRecord.expiresAt.getTime() < Date.now()) {
        await prisma.otp.delete({ where: { email: normalizedEmail } }).catch(() => {});
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail} (expiré)`);
        return res.status(400).json({ error: 'Code OTP expiré. Veuillez en demander un nouveau.' });
      }

      if (otpRecord.code !== code) {
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail} (code incorrect)`);
        return res.status(400).json({ error: 'Code OTP incorrect.' });
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            { username: username }
          ]
        }
      });
      if (existingUser) {
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail} (utilisateur existant)`);
        return res.status(400).json({ error: 'Cet utilisateur existe déjà' });
      }

      console.log(`[OTP] Vérification réussie pour ${normalizedEmail}`);
      await prisma.otp.delete({ where: { email: normalizedEmail } }).catch(() => {});

      const passwordHash = await bcrypt.hash(password, 12);
      const finalRole = roleToPrisma(role);
      const finalGender = genderToPrisma(gender);

      console.log('[REGISTRATION] Tentative de création utilisateur avec les données normalisées :', {
        username,
        email: normalizedEmail,
        role: finalRole,
        gender: finalGender,
      });

      const user = await prisma.user.create({
        data: {
          username,
          email: normalizedEmail,
          passwordHash,
          role: finalRole,
          gender: finalGender,
          birthDate: birthDate ? new Date(birthDate) : null,
          avatar: avatar || null,
          bio: bio || '',
          favoriteGenres: JSON.stringify(favoriteGenres || []),
        },
        include: { followers: true, following: true, blockedUsers: true },
      });
      console.log(`[AUTH] utilisateur authentifié - userId: ${user.id}, username: ${user.username} (inscription)`);
      const token = createToken(user.id);
      setAuthCookie(res, token);
      res.status(201).json({ token, user: serializeUser(user, true) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'email et password sont requis' });
      }
      // L'email est normalisé en minuscules à l'inscription : on aligne ici.
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { followers: true, following: true, blockedUsers: true },
      });
      if (!user || !user.passwordHash) return res.status(401).json({ error: 'Identifiants incorrects' });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });
      const token = createToken(user.id);
      setAuthCookie(res, token);
      res.json({ token, user: serializeUser(user, true) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
  });

  app.post('/api/auth/demo-login', authLimiter, async (req, res) => {
    try {
      // Cette route délivre un token sans mot de passe : réservée au
      // développement/démo, jamais exposée en production (account takeover).
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Route introuvable.' });
      }
      const { email, username, role, avatar, bio, birthDate, gender, favoriteGenres } = req.body;
      if (!email || !username) {
        return res.status(400).json({ error: 'Email et nom d’utilisateur requis' });
      }

      const normalizedEmail = email.toLowerCase();
      let user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { followers: true, following: true, blockedUsers: true },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            username,
            email: normalizedEmail,
            passwordHash: await bcrypt.hash('Plume12345', 12),
            role: roleToPrisma(role),
            gender: genderToPrisma(gender),
            birthDate: birthDate ? new Date(birthDate) : null,
            avatar: avatar || null,
            bio: bio || '',
            favoriteGenres: JSON.stringify(favoriteGenres || []),
          },
          include: { followers: true, following: true, blockedUsers: true },
        });
      }

      console.log(`[AUTH DEMO] utilisateur connecté - userId: ${user.id}, username: ${user.username}`);
      const token = createToken(user.id);
      setAuthCookie(res, token);
      res.json({ token, user: serializeUser(user, true) });
    } catch (error) {
      console.error('[AUTH DEMO] Erreur lors du demo-login:', error);
      res.status(500).json({ error: 'Erreur serveur lors de la connexion démo.' });
    }
  });

  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    try {
      const { email, password, code } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email et nouveau mot de passe requis.' });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.' });
      }

      const normalizedEmail = email.toLowerCase();
      const user = await prisma.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur introuvable.' });
      }

      // Check if request is authenticated
      const authUser = await getUserFromAuthorizationHeader(req);
      const isAuthenticated = authUser && authUser.email.toLowerCase() === normalizedEmail;

      if (!isAuthenticated) {
        if (!code) {
          return res.status(400).json({ error: 'Code OTP requis.' });
        }
        const otpRecord = await prisma.otp.findUnique({
          where: { email: normalizedEmail },
        });
        if (!otpRecord) {
          console.log(`[OTP] OTP introuvable pour ${normalizedEmail}`);
          console.log(`[OTP] Vérification échouée pour ${normalizedEmail}`);
          return res.status(400).json({ error: 'Aucun code OTP généré pour cet e-mail.' });
        }
        console.log(`[OTP] OTP trouvé pour ${normalizedEmail}`);

        if (otpRecord.expiresAt.getTime() < Date.now()) {
          await prisma.otp.delete({ where: { email: normalizedEmail } }).catch(() => {});
          console.log(`[OTP] Vérification échouée pour ${normalizedEmail} (expiré)`);
          return res.status(400).json({ error: 'Code OTP expiré. Veuillez en demander un nouveau.' });
        }
        if (otpRecord.code !== code) {
          console.log(`[OTP] Vérification échouée pour ${normalizedEmail} (code incorrect)`);
          return res.status(400).json({ error: 'Code OTP incorrect.' });
        }
        console.log(`[OTP] Vérification réussie pour ${normalizedEmail}`);
        await prisma.otp.delete({ where: { email: normalizedEmail } }).catch(() => {});
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      res.json({ message: 'Mot de passe réinitialisé avec succès.' });
    } catch (error) {
      console.error('[PLUME] reset password error:', error);
      res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe.' });
    }
  });

  // Changement de mot de passe par un utilisateur connecté : vérifie le mot de
  // passe actuel avant d'enregistrer le nouveau.
  app.post('/api/auth/change-password', authLimiter, requireAuth, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
      }
      if (!validatePassword(newPassword)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.passwordHash) {
        return res.status(400).json({ error: 'Aucun mot de passe défini pour ce compte.' });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      res.json({ message: 'Mot de passe mis à jour avec succès.' });
    } catch (error) {
      console.error('[PLUME] change password error:', error);
      res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
    }
  });

  app.post('/api/auth/verify-otp', otpLimiter, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: 'Email et code OTP requis.' });
      }

      const normalizedEmail = email.toLowerCase();
      const otpRecord = await prisma.otp.findUnique({
        where: { email: normalizedEmail },
      });

      if (!otpRecord) {
        console.log(`[OTP] OTP introuvable pour ${normalizedEmail}`);
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail}`);
        return res.status(400).json({ error: 'Aucun code OTP généré pour cet e-mail.' });
      }

      console.log(`[OTP] OTP trouvé pour ${normalizedEmail}`);

      if (otpRecord.expiresAt.getTime() < Date.now()) {
        await prisma.otp.delete({ where: { email: normalizedEmail } }).catch(() => {});
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail} (expiré)`);
        return res.status(400).json({ error: 'Code OTP expiré. Veuillez en demander un nouveau.' });
      }

      if (otpRecord.code !== code) {
        console.log(`[OTP] Vérification échouée pour ${normalizedEmail} (code incorrect)`);
        return res.status(400).json({ error: 'Code OTP incorrect.' });
      }

      console.log(`[OTP] Vérification réussie pour ${normalizedEmail}`);
      res.json({ message: 'Code OTP valide.' });
    } catch (error) {
      console.error('[PLUME OTP] Verify route error:', error);
      res.status(500).json({ error: 'Erreur lors de la vérification de l\'OTP.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: any, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { followers: true, following: true, blockedUsers: true },
    });
    res.json(serializeUser(user, true));
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  // Users
  app.get('/api/users', async (req: any, res) => {
    try {
      // Les emails ne sont exposés qu'aux administrateurs.
      const requester = await getUserFromAuthorizationHeader(req);
      const includePrivate = requester?.role === 'Administrateur';
      const users = await prisma.user.findMany({ include: { followers: true, following: true, blockedUsers: true }, orderBy: { createdAt: 'desc' } });
      res.json(users.map((u) => serializeUser(u, includePrivate)));
    } catch (error) {
      console.error('[PLUME] Erreur lors du chargement des utilisateurs, retour d\'un tableau vide par sécurité:', error);
      res.json([]);
    }
  });

  app.get('/api/users/:id', async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { followers: true, following: true, blockedUsers: true } });
      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
      // L'email n'est renvoyé que pour soi-même ou un administrateur.
      const requester = await getUserFromAuthorizationHeader(req);
      const includePrivate = requester?.id === user.id || requester?.role === 'Administrateur';
      res.json(serializeUser(user, includePrivate));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du chargement de l’utilisateur' });
    }
  });

  // Création directe d'utilisateur : réservée aux administrateurs. L'inscription
  // publique passe par /api/auth/otp/request + /api/auth/register (avec OTP).
  app.post('/api/users', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite' });
      }
      const user = req.body;
      if (!user.username || !user.email) {
        return res.status(400).json({ error: 'username et email sont requis' });
      }
      if (user.password && !validatePassword(user.password)) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.' });
      }
      const normalizedEmail = String(user.email).toLowerCase();
      const existingUser = await prisma.user.findFirst({ where: { OR: [{ email: normalizedEmail }, { username: user.username }] } });
      if (existingUser) return res.status(400).json({ error: 'Cet utilisateur existe déjà.' });
      const newUser = await prisma.user.create({
        data: {
          // L'id est généré par la base : on n'accepte pas d'id arbitraire.
          username: user.username,
          email: normalizedEmail,
          passwordHash: user.password ? await bcrypt.hash(user.password, 12) : null,
          role: roleToPrisma(user.role),
          gender: genderToPrisma(user.gender),
          birthDate: user.birthDate ? new Date(user.birthDate) : null,
          avatar: user.avatar || null,
          bio: user.bio || '',
          favoriteGenres: JSON.stringify(user.favoriteGenres || []),
        },
        include: { followers: true, following: true, blockedUsers: true },
      });
      res.status(201).json(serializeUser(newUser, true));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la création de l'utilisateur" });
    }
  });

  app.put('/api/users/:id', requireAuth, async (req: any, res) => {
    try {
      const authUser = req.user;
      const isSelf = authUser.id === req.params.id;
      const isAdmin = authUser.role === 'Administrateur';

      // Un utilisateur ne peut modifier que son propre profil (sauf admin).
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: 'Action interdite' });
      }

      const user = req.body;

      // Champs librement modifiables par le propriétaire du compte.
      const data: any = {
        username: user.username,
        email: typeof user.email === 'string' ? user.email.toLowerCase() : undefined,
        bio: user.bio ?? undefined,
        avatar: user.avatar ?? undefined,
        gender: user.gender ? genderToPrisma(user.gender) : undefined,
        birthDate: user.birthDate ? new Date(user.birthDate) : undefined,
        favoriteGenres: Array.isArray(user.favoriteGenres) ? JSON.stringify(user.favoriteGenres) : undefined,
        showFollowers: user.showFollowers,
        showFollowing: user.showFollowing,
        showFriends: user.showFriends,
        showMentions: user.showMentions,
        privateProfile: user.privateProfile,
        showBooksRead: user.showBooksRead,
        showBooksWritten: user.showBooksWritten,
        allowMessages: user.allowMessages,
        whoCanFollow: user.whoCanFollow,
        whoCanComment: user.whoCanComment,
        readingTheme: user.readingTheme,
        readingFontSize: user.readingFontSize,
        readingFontFamily: user.readingFontFamily,
        readingFullscreen: user.readingFullscreen,
        autoSaveEnabled: user.autoSaveEnabled,
        confirmDeleteStory: user.confirmDeleteStory,
        isVerified: user.isVerified,
        hasChangedRole: user.hasChangedRole,
      };

      // Changement de rôle : on interdit toute auto-promotion en
      // Administrateur. Seul un admin peut accorder ce rôle.
      if (user.role !== undefined) {
        const requestedRole = roleToPrisma(user.role);
        if (requestedRole === 'Administrateur' && !isAdmin) {
          return res.status(403).json({ error: 'Élévation de privilèges interdite.' });
        }
        data.role = requestedRole;
      }

      // Champs de modération : réservés aux administrateurs.
      if (isAdmin) {
        data.isFlagged = user.isFlagged;
        data.flagReason = user.flagReason;
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.params.id },
        data,
        include: { followers: true, following: true, blockedUsers: true },
      });
      res.json(serializeUser(updatedUser, true));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Utilisateur non trouvé ou erreur de modification' });
    }
  });

  // Signalement d'un compte : tout utilisateur connecté peut signaler, mais
  // seul ce flux (et non un PUT arbitraire) peut positionner isFlagged.
  app.post('/api/users/:id/report', requireAuth, async (req: any, res) => {
    try {
      const { reason } = req.body || {};
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          isFlagged: true,
          flagReason: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : 'Signalé par un utilisateur',
        },
      });
      console.log(`[REPORT] compte ${req.params.id} signalé par ${req.user.id}`);
      res.json({ success: true, isFlagged: updated.isFlagged });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du signalement.' });
    }
  });

  // Search
  app.get('/api/search/users', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const users = await prisma.user.findMany({
      where: { OR: [{ username: { contains: q } }, { bio: { contains: q } }] },
      include: { followers: true, following: true, blockedUsers: true },
      take: 20,
    });
    res.json(users.map((u) => serializeUser(u)));
  });

  app.get('/api/search/stories', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const stories = await prisma.story.findMany({
      where: { OR: [{ title: { contains: q } }, { description: { contains: q } }, { genre: { contains: q } }, { tags: { contains: q } }] },
      include: { author: true, chapters: true, likes: true, favorites: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(stories.map(serializeStory));
  });

  // Stories
  app.get('/api/stories', async (_req, res) => {
    try {
      const stories = await prisma.story.findMany({ include: { author: true, chapters: true, likes: true, favorites: true }, orderBy: { createdAt: 'desc' } });
      res.json(stories.map(serializeStory));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du chargement des histoires' });
    }
  });

  app.get('/api/stories/:id', async (req, res) => {
    try {
      const story = await prisma.story.findUnique({
        where: { id: req.params.id },
        include: { author: true, chapters: true, likes: true, favorites: true, comments: { include: { user: true, replies: { include: { user: true }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } } },
      });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      res.json(serializeStory(story));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du chargement du récit' });
    }
  });

  app.post('/api/stories', requireAuth, async (req: any, res) => {
    try {
      const story = req.body;
      const newStory = await prisma.story.create({
        data: {
          id: story.id || undefined,
          title: story.title || 'Sans titre',
          description: story.description || '',
          cover: story.cover || null,
          genre: story.genre || 'Non classé',
          category: story.category || null,
          ambiance: story.ambiance || null,
          format: story.format || null,
          language: story.language || 'fr',
          tags: JSON.stringify(story.tags || []),
          status: storyStatusToPrisma(story.status),
          views: story.views || 0,
          reads: story.reads || 0,
          rating: story.rating || 0,
          isFlagged: story.isFlagged || false,
          flagReason: story.flagReason || null,
          ageRating: ageRatingToPrisma(story.ageRating),
          authorId: req.user.id,
          publishedAt: story.status === 'Publié' ? new Date() : null,
        },
        include: { author: true, chapters: true, likes: true, favorites: true },
      });
      res.status(201).json(serializeStory(newStory));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de la création de l'histoire" });
    }
  });

  app.put('/api/stories/:id', requireAuth, async (req: any, res) => {
    try {
      const existing = await prisma.story.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Récit non trouvé' });
      if (existing.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const story = req.body;
      const updatedStory = await prisma.story.update({
        where: { id: req.params.id },
        data: {
          title: story.title,
          description: story.description,
          cover: story.cover,
          genre: story.genre,
          category: story.category,
          ambiance: story.ambiance,
          format: story.format,
          language: story.language,
          tags: Array.isArray(story.tags) ? JSON.stringify(story.tags) : undefined,
          status: story.status ? storyStatusToPrisma(story.status) : undefined,
          views: story.views,
          reads: story.reads,
          rating: story.rating,
          isFlagged: story.isFlagged,
          flagReason: story.flagReason,
          ageRating: story.ageRating ? ageRatingToPrisma(story.ageRating) : undefined,
          publishedAt: story.status === 'Publié' ? new Date() : undefined,
        },
        include: { author: true, chapters: true, likes: true, favorites: true },
      });
      res.json(serializeStory(updatedStory));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Récit non trouvé ou erreur de modification' });
    }
  });

  app.delete('/api/stories/:id', requireAuth, async (req: any, res) => {
    try {
      const story = await prisma.story.findUnique({ where: { id: req.params.id } });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      if (story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      await prisma.story.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Récit non trouvé ou erreur de suppression' });
    }
  });

  // Chapters
  app.get('/api/stories/:storyId/chapters', async (req, res) => {
    const chapters = await prisma.chapter.findMany({ where: { storyId: req.params.storyId }, orderBy: { order: 'asc' } });
    res.json(chapters.map(serializeChapter));
  });

  app.post('/api/stories/:storyId/chapters', requireAuth, async (req: any, res) => {
    try {
      const story = await prisma.story.findUnique({ where: { id: req.params.storyId } });
      if (!story) return res.status(404).json({ error: 'Récit non trouvé' });
      if (story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const chapter = req.body;
      const newChapter = await prisma.chapter.create({
        data: {
          id: chapter.id || undefined,
          title: chapter.title || 'Chapitre sans titre',
          content: chapter.content || '',
          order: chapter.order || 1,
          isPublished: Boolean(chapter.isPublished || chapter.status === 'Publié'),
          views: chapter.views || 0,
          reads: chapter.reads || 0,
          storyId: req.params.storyId,
          publishedAt: chapter.isPublished || chapter.status === 'Publié' ? new Date() : null,
        },
      });
      res.status(201).json(serializeChapter(newChapter));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création du chapitre' });
    }
  });

  app.put('/api/chapters/:id', requireAuth, async (req: any, res) => {
    try {
      const existingChapter = await prisma.chapter.findUnique({ where: { id: req.params.id }, include: { story: true } });
      if (!existingChapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      if (existingChapter.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const chapter = req.body;
      const updatedChapter = await prisma.chapter.update({
        where: { id: req.params.id },
        data: {
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
          views: chapter.views,
          reads: chapter.reads,
          isPublished: chapter.isPublished,
          publishedAt: chapter.isPublished ? new Date() : undefined,
        },
      });
      res.json(serializeChapter(updatedChapter));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Chapitre non trouvé ou erreur de modification' });
    }
  });

  app.delete('/api/chapters/:id', requireAuth, async (req: any, res) => {
    try {
      const existingChapter = await prisma.chapter.findUnique({ where: { id: req.params.id }, include: { story: true } });
      if (!existingChapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      if (existingChapter.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      await prisma.chapter.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Chapitre non trouvé ou erreur de suppression' });
    }
  });


  app.put('/api/stories/:storyId/chapters/:chapterId', requireAuth, async (req: any, res) => {
    req.params.id = req.params.chapterId;
    try {
      const existingChapter = await prisma.chapter.findUnique({ where: { id: req.params.chapterId }, include: { story: true } });
      if (!existingChapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      if (existingChapter.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const chapter = req.body;
      const updatedChapter = await prisma.chapter.update({
        where: { id: req.params.chapterId },
        data: {
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
          views: chapter.views,
          reads: chapter.reads,
          isPublished: chapter.isPublished,
          publishedAt: chapter.isPublished ? new Date() : undefined,
        },
      });
      res.json(serializeChapter(updatedChapter));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Chapitre non trouvé ou erreur de modification' });
    }
  });

  app.delete('/api/stories/:storyId/chapters/:chapterId', requireAuth, async (req: any, res) => {
    try {
      const existingChapter = await prisma.chapter.findUnique({ where: { id: req.params.chapterId }, include: { story: true } });
      if (!existingChapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      if (existingChapter.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      await prisma.chapter.delete({ where: { id: req.params.chapterId } });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Chapitre non trouvé ou erreur de suppression' });
    }
  });

  // Comments
  app.get('/api/comments', async (_req, res) => {
    const comments = await prisma.comment.findMany({ include: { user: true, replies: { include: { user: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(comments.map(serializeComment));
  });

  app.get('/api/stories/:storyId/comments', async (req, res) => {
    const comments = await prisma.comment.findMany({ where: { storyId: req.params.storyId }, include: { user: true, replies: { include: { user: true }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    res.json(comments.map(serializeComment));
  });

  app.post('/api/comments', requireAuth, async (req: any, res) => {
    try {
      const { storyId, chapterId, content } = req.body;
      if (!storyId || !chapterId || !content) return res.status(400).json({ error: 'storyId, chapterId et content sont requis' });
      const comment = await prisma.comment.create({ data: { storyId, chapterId, userId: req.user.id, content }, include: { user: true, replies: true } });
      const story = await prisma.story.findUnique({ where: { id: storyId }, select: { authorId: true, title: true } });
      if (story && story.authorId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: story.authorId,
            type: 'COMMENT' as any,
            title: 'Nouveau commentaire',
            message: `Quelqu’un a commenté ton histoire « ${story.title} ».`,
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: storyId,
              storyTitle: story.title,
              chapterId,
              commentId: comment.id,
              excerpt: content.length > 60 ? content.slice(0, 57) + '...' : content,
            } as any
          }
        });
        io.to(`user:${story.authorId}`).emit('new_notification', notification);
      }
      res.status(201).json(serializeComment(comment));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création du commentaire' });
    }
  });

  app.post('/api/stories/:storyId/comments', requireAuth, async (req: any, res) => {
    try {
      const { chapterId, content } = req.body;
      if (!chapterId || !content) return res.status(400).json({ error: 'chapterId et content sont requis' });
      const comment = await prisma.comment.create({
        data: { storyId: req.params.storyId, chapterId, userId: req.user.id, content },
        include: { user: true, replies: true },
      });
      const story = await prisma.story.findUnique({ where: { id: req.params.storyId }, select: { authorId: true, title: true } });
      if (story && story.authorId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: story.authorId,
            type: 'COMMENT' as any,
            title: 'Nouveau commentaire',
            message: `Quelqu’un a commenté ton histoire « ${story.title} ».`,
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: req.params.storyId,
              storyTitle: story.title,
              chapterId,
              commentId: comment.id,
              excerpt: content.length > 60 ? content.slice(0, 57) + '...' : content,
            } as any
          }
        });
        io.to(`user:${story.authorId}`).emit('new_notification', notification);
      }
      res.status(201).json(serializeComment(comment));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création du commentaire' });
    }
  });

  app.put('/api/comments/:id', requireAuth, async (req: any, res) => {
    try {
      const existing = await prisma.comment.findUnique({ where: { id: req.params.id }, include: { story: true } });
      if (!existing) return res.status(404).json({ error: 'Commentaire non trouvé' });
      if (existing.userId !== req.user.id && existing.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      const comment = await prisma.comment.update({ where: { id: req.params.id }, data: { content: req.body.content }, include: { user: true, replies: { include: { user: true } } } });
      res.json(serializeComment(comment));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Commentaire non trouvé ou erreur de modification' });
    }
  });

  app.put('/api/comments/:id/like', requireAuth, async (req: any, res) => {
    try {
      const likedByMe = Boolean(req.body.likedByMe);
      const comment = await prisma.comment.update({
        where: { id: req.params.id },
        data: { likes: { increment: likedByMe ? 1 : -1 } },
        include: { user: true, replies: { include: { user: true } } },
      });
      res.json(serializeComment(comment));
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Commentaire non trouvé' });
    }
  });

  app.delete('/api/comments/:id', requireAuth, async (req: any, res) => {
    try {
      const existing = await prisma.comment.findUnique({ where: { id: req.params.id }, include: { story: true } });
      if (!existing) return res.status(404).json({ error: 'Commentaire non trouvé' });
      if (existing.userId !== req.user.id && existing.story.authorId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
      await prisma.comment.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(404).json({ error: 'Commentaire non trouvé ou erreur de suppression' });
    }
  });

  app.post('/api/comments/:id/replies', requireAuth, async (req: any, res) => {
    try {
      const reply = await prisma.commentReply.create({ data: { commentId: req.params.id, userId: req.user.id, content: req.body.content }, include: { user: true } });
      const parent = await prisma.comment.findUnique({ where: { id: req.params.id }, select: { userId: true, storyId: true, chapterId: true } });
      if (parent && parent.userId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: parent.userId,
            type: 'COMMENT_REPLY' as any,
            title: 'Nouvelle réponse',
            message: 'Quelqu’un a répondu à ton commentaire.',
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: parent.storyId,
              chapterId: parent.chapterId,
              commentId: req.params.id,
              excerpt: req.body.content.length > 60 ? req.body.content.slice(0, 57) + '...' : req.body.content,
            } as any
          }
        });
        io.to(`user:${parent.userId}`).emit('new_notification', notification);
      }
      res.status(201).json(serializeComment({ ...reply, replies: [] }));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la création de la réponse' });
    }
  });

  // Notifications
  app.get('/api/notifications/:userId', requireAuth, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
    const notifications = await prisma.notification.findMany({ where: { userId: req.params.userId }, orderBy: { createdAt: 'desc' } });
    res.json(notifications);
  });

  app.put('/api/notifications/:id/read', requireAuth, async (req: any, res) => {
    try {
      // On vérifie l'appartenance AVANT toute écriture (sinon IDOR : on
      // marquerait comme lue la notification d'autrui).
      const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Notification introuvable' });
      if (existing.userId !== req.user.id && req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite' });
      }
      const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
      res.json(notification);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour de la notification' });
    }
  });

  app.put('/api/notifications/:userId/read-all', requireAuth, async (req: any, res) => {
    if (req.user.id !== req.params.userId && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
    await prisma.notification.updateMany({ where: { userId: req.params.userId, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  });

  // In-memory anti-spam rate limiter
  const lastMessageTimes = new Map<string, number>();

  // Conversations & Messages
  app.post('/api/conversations', requireAuth, async (req: any, res) => {
    try {
      const { participantIds } = req.body;
      const targetUserId = participantIds?.find((id: string) => id !== req.user.id);
      console.log("currentUser.id =", req.user.id);
      console.log("targetUser.id =", targetUserId);
      if (req.user.id.startsWith("user_") || (targetUserId && targetUserId.startsWith("user_"))) {
        console.error("[PLUME ERROR] Un ID commence par 'user_' ou correspond à un compte de démonstration interdit.");
      }
      console.log(`[CONVERSATION] tentative de création de conversation - participantIds: ${JSON.stringify(participantIds)}, initiateur: ${req.user.id}`);
      
      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return res.status(400).json({ error: 'participantIds (tableau non vide) est requis' });
      }

      // Ensure current user is in participants
      const targetIds = Array.from(new Set([req.user.id, ...participantIds]));

      // Verify that all users exist
      const users = await prisma.user.findMany({
        where: { id: { in: targetIds } }
      });
      if (users.length !== targetIds.length) {
        console.warn(`[CONVERSATION] erreur création : certains participants n'existent pas dans targetIds: ${JSON.stringify(targetIds)}`);
        return res.status(400).json({ error: 'Un ou plusieurs participants n’existent pas' });
      }

      // If it's a 1-to-1 conversation, try to find an existing one
      let existingConversation: any = null;
      if (targetIds.length === 2) {
        const userConversations = await prisma.conversation.findMany({
          where: {
            participants: {
              some: { id: req.user.id }
            }
          },
          include: {
            participants: true
          }
        });

        existingConversation = userConversations.find(conv => {
          const ids = conv.participants.map(p => p.id);
          return ids.length === 2 && targetIds.every(id => ids.includes(id));
        });
      }

      if (existingConversation) {
        console.log(`[CONVERSATION] conversation existante renvoyée - conversationId: ${existingConversation.id}`);
        return res.json(existingConversation);
      }

      // Create new conversation
      const conversation = await prisma.conversation.create({
        data: {
          participants: {
            connect: targetIds.map(id => ({ id }))
          }
        },
        include: {
          participants: true
        }
      });

      // Broadcast creation to all participants
      targetIds.forEach(id => {
        io.to(`user:${id}`).emit('conversation_created', conversation);
      });

      console.log(`[CONVERSATION] conversation créée - conversationId: ${conversation.id}`);
      res.status(201).json(conversation);
    } catch (error: any) {
      console.error(`[CONVERSATION] erreur création :`, error);
      res.status(500).json({ error: `Erreur lors de la création de la conversation : ${error.message || 'erreur serveur'}` });
    }
  });

  app.get('/api/conversations', requireAuth, async (req: any, res) => {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: { id: req.user.id }
          }
        },
        include: {
          participants: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      // Compute unread count for each conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: req.user.id },
              isRead: false
            }
          });
          return {
            ...conv,
            unreadCount
          };
        })
      );

      res.json(conversationsWithUnread);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de la récupération des conversations' });
    }
  });

  app.get('/api/conversations/:id/messages', requireAuth, async (req: any, res) => {
    try {
      console.log(`[CONVERSATION] accès aux messages - conversationId: ${req.params.id}, userId: ${req.user.id}`);
      const conversation = await prisma.conversation.findUnique({
        where: { id: req.params.id },
        include: { participants: true }
      });

      if (!conversation) {
        console.warn(`[CONVERSATION] erreur accès - conversationId: ${req.params.id} non trouvée`);
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const isParticipant = conversation.participants.some(p => p.id === req.user.id);
      if (!isParticipant && req.user.role !== 'Administrateur') {
        console.warn(`[CONVERSATION] erreur accès - conversationId: ${req.params.id}, action interdite pour userId: ${req.user.id}`);
        return res.status(403).json({ error: 'Action interdite' });
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: req.params.id },
        include: {
          sender: true
        },
        orderBy: { createdAt: 'asc' }
      });

      res.json(messages);
    } catch (error) {
      console.error(`[CONVERSATION] erreur accès - conversationId: ${req.params.id}:`, error);
      res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
    }
  });

  app.post('/api/messages', requireAuth, async (req: any, res) => {
    try {
      const { conversationId, content } = req.body;
      // L'expéditeur est TOUJOURS l'utilisateur authentifié : on ignore tout
      // senderId fourni par le client (sinon usurpation d'identité possible).
      const senderId = req.user.id;

      if (!conversationId || !content) {
        console.warn(`[MESSAGE] Paramètres manquants : conversationId=${conversationId}, content=${content}`);
        return res.status(400).json({ error: 'conversationId et content sont requis' });
      }

      // Content length limit (anti-spam / validation)
      const trimmed = content.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Le contenu du message ne peut pas être vide' });
      }
      if (trimmed.length > 2000) {
        return res.status(400).json({ error: 'Le contenu du message ne doit pas dépasser 2000 caractères' });
      }

      // In-memory anti-spam check (300ms limit)
      const now = Date.now();
      const lastTime = lastMessageTimes.get(req.user.id) || 0;
      if (now - lastTime < 300) {
        console.warn(`[MESSAGE] Bloqué par l’anti-spam - utilisateur: ${req.user.id}`);
        return res.status(429).json({ error: 'Veuillez patienter avant d’envoyer un autre message (anti-spam)' });
      }
      lastMessageTimes.set(req.user.id, now);

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: true }
      });

      if (!conversation) {
        console.warn(`[MESSAGE] Conversation non trouvée : ${conversationId}`);
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const isParticipant = conversation.participants.some(p => p.id === senderId);
      if (!isParticipant) {
        console.warn(`[MESSAGE] Utilisateur ${senderId} non participant à la conversation ${conversationId}`);
        return res.status(403).json({ error: 'Action interdite' });
      }

      // Create message
      let message;
      try {
        message = await prisma.message.create({
          data: {
            conversationId,
            senderId,
            content: trimmed,
            isRead: false
          },
          include: {
            sender: true
          }
        });
        console.log(`[MESSAGE] sauvegarde - messageId: ${message.id}`);
      } catch (dbErr) {
        console.error(`[MESSAGE] erreur sauvegarde :`, dbErr);
        throw dbErr;
      }

      // Update conversation updatedAt timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      // Find the actual sender details
      const actualSender = conversation.participants.find(p => p.id === senderId) || req.user;

      // Create system notification for all other participants and emit via socket
      await Promise.all(
        conversation.participants
          .filter(p => p.id !== senderId)
          .map(async (p) => {
            const notification = await prisma.notification.create({
              data: {
                userId: p.id,
                type: 'MESSAGE' as any,
                title: 'Nouveau message',
                message: `Tu as reçu un nouveau message de ${actualSender.username}.`,
                data: {
                  actorId: actualSender.id,
                  actorName: actualSender.username,
                  actorAvatar: actualSender.avatar || '',
                  conversationId,
                  excerpt: trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed,
                } as any
              }
            });
            io.to(`user:${p.id}`).emit('new_notification', notification);
          })
      );

      // Broadcast message to all conversation participants
      conversation.participants.forEach(p => {
        io.to(`user:${p.id}`).emit('new_message', message);
        console.log(`[SOCKET] message émis - conversationId: ${conversationId}, messageId: ${message.id}, destinataire: ${p.id}`);
      });

      res.status(201).json(message);
    } catch (error) {
      console.error('[MESSAGE] Erreur sauvegarde globale :', error);
      res.status(500).json({ error: 'Erreur lors de l’envoi du message' });
    }
  });

  app.put('/api/messages/read', requireAuth, async (req: any, res) => {
    try {
      const { conversationId } = req.body;
      if (!conversationId) {
        return res.status(400).json({ error: 'conversationId est requis' });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { participants: true }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation non trouvée' });
      }

      const isParticipant = conversation.participants.some(p => p.id === req.user.id);
      if (!isParticipant) {
        return res.status(403).json({ error: 'Action interdite' });
      }

      // Mark all messages as read
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: req.user.id },
          isRead: false
        },
        data: {
          isRead: true
        }
      });

      // Broadcast update to all participants
      conversation.participants.forEach(p => {
        io.to(`user:${p.id}`).emit('messages_read', { conversationId, readerId: req.user.id });
      });

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du marquage comme lu' });
    }
  });

  // Follow
  app.post('/api/users/:id/follow', requireAuth, async (req: any, res) => {
    const followingId = req.params.id;
    console.log("currentUser.id =", req.user.id);
    console.log("targetUser.id =", followingId);
    if (req.user.id.startsWith("user_") || followingId.startsWith("user_")) {
      console.error("[PLUME ERROR] Un ID commence par 'user_' ou correspond à un compte de démonstration interdit.");
    }
    try {
      if (followingId === req.user.id) {
        return res.status(400).json({ error: 'Tu ne peux pas te suivre toi-même' });
      }
      const follow = await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: req.user.id, followingId } },
        update: {},
        create: { followerId: req.user.id, followingId },
      });

      const notification = await prisma.notification.create({
        data: {
          userId: followingId,
          type: 'FOLLOW' as any,
          title: 'Nouvel abonné',
          message: `@${req.user.username || 'Un utilisateur'} a commencé à te suivre.`,
          data: {
            actorId: req.user.id,
            actorName: req.user.username,
            actorAvatar: req.user.avatar || '',
          } as any
        },
      });

      io.to(`user:${followingId}`).emit('new_notification', notification);
      
      // Real-time synchronization socket events for follow
      io.to(`user:${followingId}`).emit('user_followed', { followerId: req.user.id, followingId });
      io.to(`user:${req.user.id}`).emit('user_followed', { followerId: req.user.id, followingId });

      // Fetch updated users
      const updatedCurrentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { followers: true, following: true, blockedUsers: true }
      });
      const updatedTargetUser = await prisma.user.findUnique({
        where: { id: followingId },
        include: { followers: true, following: true, blockedUsers: true }
      });

      console.log(`[FOLLOW] succès de l'abonnement - followerId: ${req.user.id}, followingId: ${followingId}`);
      res.status(201).json({ 
        follow, 
        notification,
        currentUser: serializeUser(updatedCurrentUser, true),
        targetUser: serializeUser(updatedTargetUser)
      });
    } catch (error) {
      console.error(`[FOLLOW] erreur lors de l'abonnement - followerId: ${req.user.id}, followingId: ${followingId} :`, error);
      res.status(500).json({ error: "Erreur lors de l'abonnement" });
    }
  });

  app.delete('/api/users/:id/follow', requireAuth, async (req: any, res) => {
    const followingId = req.params.id;
    console.log("currentUser.id =", req.user.id);
    console.log("targetUser.id =", followingId);
    if (req.user.id.startsWith("user_") || followingId.startsWith("user_")) {
      console.error("[PLUME ERROR] Un ID commence par 'user_' ou correspond à un compte de démonstration interdit.");
    }
    try {
      await prisma.follow.deleteMany({
        where: {
          followerId: req.user.id,
          followingId,
        },
      });

      // Real-time synchronization socket events for unfollow
      io.to(`user:${followingId}`).emit('user_unfollowed', { followerId: req.user.id, followingId });
      io.to(`user:${req.user.id}`).emit('user_unfollowed', { followerId: req.user.id, followingId });

      // Fetch updated users
      const updatedCurrentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { followers: true, following: true, blockedUsers: true }
      });
      const updatedTargetUser = await prisma.user.findUnique({
        where: { id: followingId },
        include: { followers: true, following: true, blockedUsers: true }
      });

      console.log(`[FOLLOW] succès de désabonnement - followerId: ${req.user.id}, followingId: ${followingId}`);
      res.status(200).json({
        currentUser: serializeUser(updatedCurrentUser, true),
        targetUser: serializeUser(updatedTargetUser)
      });
    } catch (error) {
      console.error(`[FOLLOW] erreur lors du désabonnement - followerId: ${req.user.id}, followingId: ${followingId} :`, error);
      res.status(500).json({ error: 'Abonnement non trouvé' });
    }
  });

  app.get('/api/users/:id/followers', async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (!target.showFollowers) return res.status(403).json({ error: 'La liste des abonnés est privée' });
    const followers = await prisma.follow.findMany({ where: { followingId: req.params.id }, include: { follower: true }, orderBy: { createdAt: 'desc' } });
    res.json(followers.map((f: any) => serializeUser(f.follower)));
  });

  app.get('/api/users/:id/following', async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (!target.showFollowing) return res.status(403).json({ error: 'La liste des suivis est privée' });
    const following = await prisma.follow.findMany({ where: { followerId: req.params.id }, include: { following: true }, orderBy: { createdAt: 'desc' } });
    res.json(following.map((f: any) => serializeUser(f.following)));
  });

  // Friends
  app.post('/api/friends/request/:id', requireAuth, async (req: any, res) => {
    try {
      const receiverId = req.params.id;
      if (receiverId === req.user.id) return res.status(400).json({ error: 'Demande impossible' });
      const target = await prisma.user.findUnique({ where: { id: receiverId } });
      if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
      const friendship = await prisma.friendship.upsert({ where: { requesterId_receiverId: { requesterId: req.user.id, receiverId } }, update: { status: 'PENDING' as any }, create: { requesterId: req.user.id, receiverId } });
      const notification = await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'FRIEND_REQUEST' as any,
          title: 'Demande d’ami',
          message: 'Tu as reçu une demande d’ami.',
          data: {
            actorId: req.user.id,
            actorName: req.user.username,
            actorAvatar: req.user.avatar || '',
          } as any
        }
      });
      io.to(`user:${receiverId}`).emit('new_notification', notification);
      res.status(201).json(friendship);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de l'envoi de la demande d'ami" });
    }
  });

  app.post('/api/friends/accept/:id', requireAuth, async (req: any, res) => {
    try {
      // Autorisation vérifiée AVANT modification (sinon IDOR : on pourrait
      // accepter une demande d'ami dont on n'est pas le destinataire).
      const existing = await prisma.friendship.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Demande introuvable' });
      if (existing.receiverId !== req.user.id && req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite' });
      }
      const friendship = await prisma.friendship.update({ where: { id: req.params.id }, data: { status: 'ACCEPTED' as any } });
      const notification = await prisma.notification.create({
        data: {
          userId: friendship.requesterId,
          type: 'FRIEND_ACCEPTED' as any,
          title: 'Demande acceptée',
          message: 'Ta demande d’ami a été acceptée.',
          data: {
            actorId: req.user.id,
            actorName: req.user.username,
            actorAvatar: req.user.avatar || '',
          } as any
        }
      });
      io.to(`user:${friendship.requesterId}`).emit('new_notification', notification);
      res.json(friendship);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erreur lors de l'acceptation de la demande" });
    }
  });

  app.post('/api/friends/reject/:id', requireAuth, async (req: any, res) => {
    try {
      const existing = await prisma.friendship.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Demande introuvable' });
      if (existing.receiverId !== req.user.id && req.user.role !== 'Administrateur') {
        return res.status(403).json({ error: 'Action interdite' });
      }
      const friendship = await prisma.friendship.update({ where: { id: req.params.id }, data: { status: 'REJECTED' as any } });
      res.json(friendship);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du rejet de la demande' });
    }
  });

  app.get('/api/friends', requireAuth, async (req: any, res) => {
    const friendships = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED' as any, OR: [{ requesterId: req.user.id }, { receiverId: req.user.id }] },
      include: { requester: true, receiver: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(friendships.map((f: any) => serializeUser(f.requesterId === req.user.id ? f.receiver : f.requester)));
  });

  app.delete('/api/friends/:id', requireAuth, async (req: any, res) => {
    const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!friendship) return res.status(404).json({ error: 'Relation non trouvée' });
    if (friendship.requesterId !== req.user.id && friendship.receiverId !== req.user.id && req.user.role !== 'Administrateur') return res.status(403).json({ error: 'Action interdite' });
    await prisma.friendship.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });

  // Likes and Favorites
  app.post('/api/stories/:id/like', requireAuth, async (req: any, res) => {
    try {
      const like = await prisma.storyLike.upsert({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } }, update: {}, create: { userId: req.user.id, storyId: req.params.id } });
      const story = await prisma.story.findUnique({ where: { id: req.params.id } });
      if (story && story.authorId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: story.authorId,
            type: 'LIKE' as any,
            title: 'Nouveau like',
            message: 'Quelqu’un a aimé ton histoire.',
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: req.params.id,
              storyTitle: story.title,
            } as any
          }
        });
        io.to(`user:${story.authorId}`).emit('new_notification', notification);
      }
      res.status(201).json(like);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du like' });
    }
  });

  app.delete('/api/stories/:id/like', requireAuth, async (req: any, res) => {
    await prisma.storyLike.delete({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } }).catch(() => null);
    res.status(204).end();
  });

  app.get('/api/stories/:id/likes', async (req, res) => {
    const likes = await prisma.storyLike.findMany({ where: { storyId: req.params.id }, include: { user: true } });
    res.json(likes.map((l: any) => serializeUser(l.user)));
  });

  app.post('/api/stories/:id/favorite', requireAuth, async (req: any, res) => {
    try {
      const favorite = await prisma.favorite.upsert({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } }, update: {}, create: { userId: req.user.id, storyId: req.params.id } });
      const story = await prisma.story.findUnique({ where: { id: req.params.id } });
      if (story && story.authorId !== req.user.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: story.authorId,
            type: 'FAVORITE' as any,
            title: 'Nouveau favori',
            message: 'Quelqu’un a ajouté ton histoire en favori.',
            data: {
              actorId: req.user.id,
              actorName: req.user.username,
              actorAvatar: req.user.avatar || '',
              storyId: req.params.id,
              storyTitle: story.title,
            } as any
          }
        });
        io.to(`user:${story.authorId}`).emit('new_notification', notification);
      }
      res.status(201).json(favorite);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’ajout en favori' });
    }
  });

  app.delete('/api/stories/:id/favorite', requireAuth, async (req: any, res) => {
    await prisma.favorite.delete({ where: { userId_storyId: { userId: req.user.id, storyId: req.params.id } } }).catch(() => null);
    res.status(204).end();
  });

  app.get('/api/me/favorites', requireAuth, async (req: any, res) => {
    const favorites = await prisma.favorite.findMany({ where: { userId: req.user.id }, include: { story: { include: { author: true, chapters: true, likes: true, favorites: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(favorites.map((f: any) => serializeStory(f.story)));
  });

  // Reading
  app.post('/api/stories/:id/read', requireAuth, async (req: any, res) => {
    try {
      const chapterId = req.body.chapterId || null;
      const history = await prisma.readingHistory.create({ data: { userId: req.user.id, storyId: req.params.id, chapterId } });
      await prisma.story.update({ where: { id: req.params.id }, data: { reads: { increment: 1 }, views: { increment: 1 } } }).catch(() => null);
      if (chapterId) await prisma.chapter.update({ where: { id: chapterId }, data: { reads: { increment: 1 }, views: { increment: 1 } } }).catch(() => null);
      res.status(201).json(history);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’enregistrement de la lecture' });
    }
  });

  app.get('/api/me/history', requireAuth, async (req: any, res) => {
    const history = await prisma.readingHistory.findMany({ where: { userId: req.user.id }, include: { story: { include: { author: true, chapters: true, likes: true, favorites: true } }, chapter: true }, orderBy: { createdAt: 'desc' } });
    res.json(history.map((h: any) => ({ ...h, story: serializeStory(h.story), chapter: serializeChapter(h.chapter) })));
  });

  app.post('/api/chapters/:id/progress', requireAuth, async (req: any, res) => {
    try {
      const chapter = await prisma.chapter.findUnique({ where: { id: req.params.id } });
      if (!chapter) return res.status(404).json({ error: 'Chapitre non trouvé' });
      const progressPercent = Math.min(100, Math.max(0, Number(req.body.progressPercent || 0)));
      const progress = await prisma.readingProgress.upsert({
        where: { userId_storyId_chapterId: { userId: req.user.id, storyId: chapter.storyId, chapterId: chapter.id } },
        update: { progressPercent, lastReadAt: new Date() },
        create: { userId: req.user.id, storyId: chapter.storyId, chapterId: chapter.id, progressPercent },
        include: { story: true, chapter: true },
      });
      res.json({ ...progress, story: { ...progress.story, tags: parseJsonArray(progress.story.tags) }, chapter: serializeChapter(progress.chapter) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors de l’enregistrement de la progression' });
    }
  });

  app.get('/api/stories/:id/progress', requireAuth, async (req: any, res) => {
    const progress = await prisma.readingProgress.findMany({ where: { userId: req.user.id, storyId: req.params.id }, include: { chapter: true }, orderBy: { lastReadAt: 'desc' } });
    res.json(progress.map((p: any) => ({ ...p, chapter: serializeChapter(p.chapter) })));
  });

  // Block users
  app.post('/api/users/:id/block', requireAuth, async (req: any, res) => {
    try {
      const blockedId = req.params.id;
      if (blockedId === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas te bloquer toi-même' });
      const block = await prisma.blockedUser.upsert({
        where: { blockerId_blockedId: { blockerId: req.user.id, blockedId } },
        update: {},
        create: { blockerId: req.user.id, blockedId },
      });
      res.status(201).json(block);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erreur lors du blocage' });
    }
  });

  app.delete('/api/users/:id/block', requireAuth, async (req: any, res) => {
    await prisma.blockedUser.deleteMany({ where: { blockerId: req.user.id, blockedId: req.params.id } });
    res.status(204).end();
  });

  app.get('/api/me/blocked', requireAuth, async (req: any, res) => {
    const blocks = await prisma.blockedUser.findMany({
      where: { blockerId: req.user.id },
      include: { blocked: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(blocks.map((b: any) => serializeUser(b.blocked)));
  });

  if (process.env.NODE_ENV !== 'test') {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Mode développement : Initialisation du serveur de développement Vite...');
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
    } else {
      console.log('Mode production : Service des fichiers statiques depuis "dist"...');
      const distPath = process.cwd().endsWith('dist') ? process.cwd() : path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }
  }

  return { app, httpServer, io };
}

if (process.env.NODE_ENV !== 'test') {
  createServerInstance().then(({ httpServer }) => {
    const PORT = Number(process.env.PORT || 3000);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[PLUME App] Backend + Socket.io en écoute sur http://0.0.0.0:${PORT}`);
    });
  }).catch((err) => {
    console.error('Erreur au démarrage du serveur principal :', err);
  });
}

