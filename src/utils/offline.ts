/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lecture HORS LIGNE : téléchargement de livres dans l'application (façon
 * YouTube). Le récit complet (chapitres inclus) est stocké localement et reste
 * lisible sans connexion. Les couvertures distantes ne s'afficheront pas hors
 * ligne, mais le texte est intégralement disponible.
 */

import type { Story } from '../types';

const KEY = 'plume_offline_books_v1';

/** Renvoie la liste des récits téléchargés (les plus récents d'abord). */
export function getDownloadedBooks(): Story[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function isDownloaded(storyId: string): boolean {
  return getDownloadedBooks().some((b) => b.id === storyId);
}

/** Télécharge (stocke) un récit complet pour la lecture hors ligne. */
export function downloadBook(story: Story): boolean {
  try {
    if (!story?.id) return false;
    const books = getDownloadedBooks().filter((b) => b.id !== story.id);
    // On marque la date de téléchargement pour l'affichage de la section.
    const toStore = { ...story, _downloadedAt: new Date().toISOString() } as Story;
    books.unshift(toStore);
    localStorage.setItem(KEY, JSON.stringify(books));
    window.dispatchEvent(new Event('plume-offline-changed'));
    return true;
  } catch {
    return false;
  }
}

/** Supprime un récit téléchargé. */
export function removeDownload(storyId: string): void {
  try {
    const books = getDownloadedBooks().filter((b) => b.id !== storyId);
    localStorage.setItem(KEY, JSON.stringify(books));
    window.dispatchEvent(new Event('plume-offline-changed'));
  } catch {
    /* ignore */
  }
}

/** Récupère un récit téléchargé par son id (pour la lecture hors ligne). */
export function getDownloadedBook(storyId: string): Story | null {
  return getDownloadedBooks().find((b) => b.id === storyId) || null;
}
