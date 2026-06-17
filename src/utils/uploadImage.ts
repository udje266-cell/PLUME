/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Upload d'images vers Cloudinary (avatars, bannières, couvertures, PlumeCard…).
 *
 * Robuste en APK natif : la config Cloudinary est d'abord lue au BUILD
 * (import.meta.env.VITE_CLOUDINARY_*), et à défaut récupérée au RUNTIME depuis
 * le backend (`/api/config`) — indispensable pour l'app native où les variables
 * de build peuvent manquer. Gère la progression, un timeout, un réessai
 * automatique et des messages d'erreur explicites.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
const UPLOAD_TIMEOUT_MS = 60_000;

let cachedConfig: { cloudName: string; uploadPreset: string } | null = null;

async function getCloudinaryConfig(): Promise<{ cloudName: string; uploadPreset: string }> {
  // 1) Config injectée au build (web servi same-origin).
  const envCloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const envPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;
  if (envCloud && envPreset) return { cloudName: envCloud, uploadPreset: envPreset };

  // 2) Sinon (typiquement en natif) : config fournie par le backend au runtime.
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      const c = data?.cloudinary;
      if (c?.cloudName && c?.uploadPreset) {
        cachedConfig = { cloudName: c.cloudName, uploadPreset: c.uploadPreset };
        return cachedConfig;
      }
    }
  } catch {
    /* on tombe sur l'erreur ci-dessous */
  }
  throw new Error(
    "Service d'images indisponible : configuration Cloudinary absente (côté serveur : VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET).",
  );
}

function postToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', uploadPreset);
    form.append('folder', 'plume');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        return reject(new Error('Réponse Cloudinary illisible.'));
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
        resolve(data.secure_url as string);
      } else {
        reject(new Error(data?.error?.message || `Échec de l'envoi (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Erreur réseau pendant l’envoi de l’image.'));
    xhr.ontimeout = () => reject(new Error('Délai dépassé pendant l’envoi de l’image.'));
    xhr.send(form);
  });
}

function postVideoToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', uploadPreset);
    form.append('folder', 'plume');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
    xhr.timeout = 120_000;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        return reject(new Error('Réponse Cloudinary illisible.'));
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
        resolve(data.secure_url as string);
      } else {
        reject(new Error(data?.error?.message || `Échec de l'envoi (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Erreur réseau pendant l’envoi de la vidéo.'));
    xhr.ontimeout = () => reject(new Error('Délai dépassé pendant l’envoi de la vidéo.'));
    xhr.send(form);
  });
}

/**
 * Envoie une vidéo (sticker vidéo) et renvoie son URL sécurisée Cloudinary.
 * Le rognage et la découpe sont appliqués à la LIVRAISON via les transformations
 * d'URL (voir buildVideoStickerUrl) — pas besoin de traiter la vidéo localement.
 */
export async function uploadVideoToCloudinary(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (!file || !(file instanceof Blob)) {
    throw new Error('Fichier vidéo invalide.');
  }
  if (file.type && !file.type.startsWith('video/')) {
    throw new Error('Le fichier doit être une vidéo.');
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('La vidéo ne doit pas dépasser 30 Mo.');
  }
  const { cloudName, uploadPreset } = await getCloudinaryConfig();
  try {
    return await postVideoToCloudinary(file, cloudName, uploadPreset, onProgress);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/réseau|délai/i.test(msg)) {
      onProgress?.(0);
      return await postVideoToCloudinary(file, cloudName, uploadPreset, onProgress);
    }
    throw e;
  }
}

/**
 * Envoie une NOTE VOCALE (audio) et renvoie son URL sécurisée. Cloudinary range
 * l'audio sous la ressource « video » → on passe par le même point d'entrée.
 */
export async function uploadVoiceToCloudinary(blob: Blob, onProgress?: (pct: number) => void): Promise<string> {
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Note vocale invalide.');
  }
  if (blob.size > 12 * 1024 * 1024) {
    throw new Error('Note vocale trop longue (12 Mo max).');
  }
  const file = blob instanceof File ? blob : new File([blob], 'voice.webm', { type: blob.type || 'audio/webm' });
  const { cloudName, uploadPreset } = await getCloudinaryConfig();
  try {
    return await postVideoToCloudinary(file, cloudName, uploadPreset, onProgress);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/réseau|délai/i.test(msg)) {
      onProgress?.(0);
      return await postVideoToCloudinary(file, cloudName, uploadPreset, onProgress);
    }
    throw e;
  }
}

/**
 * Envoie une image et renvoie son URL sécurisée.
 * @param onProgress callback de progression (0..100), optionnel.
 */
export async function uploadImageToCloudinary(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (!file || !(file instanceof Blob)) {
    throw new Error('Fichier image invalide.');
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Le fichier doit être une image.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('L’image ne doit pas dépasser 10 Mo.');
  }

  const { cloudName, uploadPreset } = await getCloudinaryConfig();

  try {
    return await postToCloudinary(file, cloudName, uploadPreset, onProgress);
  } catch (e: any) {
    // Réessai automatique unique en cas d'erreur réseau / timeout.
    const msg = String(e?.message || '');
    if (/réseau|délai/i.test(msg)) {
      onProgress?.(0);
      return await postToCloudinary(file, cloudName, uploadPreset, onProgress);
    }
    throw e;
  }
}
