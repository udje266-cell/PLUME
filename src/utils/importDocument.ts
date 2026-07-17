/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Import d'un document déjà écrit (Word .docx / texte .txt) vers un chapitre
 * PLUME — pour ne PAS avoir à retaper un texte existant. Le contenu est produit
 * en HTML (le format de l'éditeur), avec conservation du gras/italique/titres
 * pour le Word.
 *
 * NB : le convertisseur Word (mammoth, ~500 Ko) est chargé À LA DEMANDE (import
 * dynamique) uniquement quand on importe un .docx — il ne pèse donc pas sur le
 * démarrage de l'application.
 */

export interface ImportedChapter {
  title: string;
  content: string; // HTML
}

// Échappe le texte brut pour l'insérer sans risque dans du HTML.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Texte brut -> HTML : chaque ligne non vide devient un paragraphe.
function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

/**
 * Convertit un fichier importé en HTML de chapitre.
 * - .docx : conversion fidèle via mammoth (gras, italique, titres, listes…).
 * - .txt  : paragraphes à partir des lignes.
 * Lève une Error au message lisible si le format n'est pas géré.
 */
export async function fileToHtml(file: File): Promise<string> {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    // Chargement à la demande : mammoth n'est téléchargé qu'ici.
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = (result.value || '').trim();
    if (!html) throw new Error('Le document Word semble vide.');
    return html;
  }
  if (name.endsWith('.txt') || file.type.startsWith('text/')) {
    const text = await file.text();
    const html = textToHtml(text);
    if (!html) throw new Error('Le fichier texte semble vide.');
    return html;
  }
  if (name.endsWith('.doc')) {
    throw new Error("L'ancien format .doc n'est pas géré. Enregistre-le en .docx depuis Word puis réessaie.");
  }
  throw new Error('Format non géré. Formats acceptés : .docx (Word) et .txt.');
}

// Marqueur de début de chapitre dans le texte d'un titre/paragraphe :
// « Chapitre 3 », « Chapter II », « Tome 1 », « Prologue », « Épilogue »…
const CHAPTER_MARKER = /^\s*(chapitre|chapter|tome|partie|prologue|épilogue|epilogue|interlude)\b/i;

/**
 * Découpe un HTML de document en plusieurs chapitres.
 * Un nouveau chapitre commence à chaque titre (<h1>/<h2>/<h3>) OU à chaque
 * paragraphe court ressemblant à un marqueur (« Chapitre X »). Le texte du
 * marqueur devient le titre du chapitre.
 * Renvoie [] si aucune césure claire n'est trouvée (=> garder en 1 chapitre).
 */
export function splitIntoChapters(html: string): ImportedChapter[] {
  if (typeof document === 'undefined') return [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const nodes = Array.from(doc.body.childNodes);

  const isBreak = (el: Element): string | null => {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || '').trim();
    if (/^h[1-3]$/.test(tag) && text) return text;
    // Paragraphe COURT qui ressemble à « Chapitre X » (évite de casser un vrai
    // paragraphe qui commencerait par le mot « Chapitre »).
    if ((tag === 'p') && text.length <= 60 && CHAPTER_MARKER.test(text)) return text;
    return null;
  };

  const chapters: ImportedChapter[] = [];
  let current: ImportedChapter | null = null;

  for (const node of nodes) {
    if (node.nodeType === 1) {
      const el = node as Element;
      const title = isBreak(el);
      if (title !== null) {
        if (current) chapters.push(current);
        current = { title: title.slice(0, 200), content: '' };
        continue; // le titre n'est pas répété dans le corps
      }
    }
    const html2 = node.nodeType === 1 ? (node as Element).outerHTML : escapeHtml(node.textContent || '');
    if (!current) current = { title: '', content: '' };
    current.content += html2;
  }
  if (current) chapters.push(current);

  // Nettoyage : on retire les sections totalement vides.
  const cleaned = chapters
    .map((c) => ({ title: c.title.trim(), content: c.content.trim() }))
    .filter((c) => c.content.replace(/<[^>]+>/g, '').trim().length > 0 || c.title.length > 0);

  // Moins de 2 sections réelles => pas de découpage pertinent.
  return cleaned.length >= 2 ? cleaned : [];
}
