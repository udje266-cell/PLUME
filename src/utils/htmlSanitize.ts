/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assainissement du contenu HTML STOCKE (corps des chapitres), applique cote
 * SERVEUR a l'ecriture (source de verite) — defense en profondeur, pour ne pas
 * dependre uniquement de l'assainissement au rendu cote client.
 *
 * Strategie (pure regex, donc utilisable en Node ET dans le navigateur) :
 *   1. Suppression COMPLETE des blocs dangereux et de leur contenu
 *      (script, style, iframe, object, embed, svg, math, template, noscript).
 *   2. Suppression des commentaires HTML (peuvent cacher des charges utiles).
 *   3. On ne conserve qu'une liste blanche de balises STRUCTURELLES/inline, en
 *      SUPPRIMANT TOUS LEURS ATTRIBUTS — ce qui neutralise d'un coup les
 *      gestionnaires d'evenements (onerror/onclick…), les URL `javascript:` et
 *      les `style=` inline. Toute balise hors liste (img, a, script…) est retiree
 *      (son texte eventuel reste, inoffensif).
 *
 * Le rendu client (ReadingView) transforme ensuite ces balises structurelles en
 * equivalents surs ; conserver leur NOM (sans attribut) suffit a la mise en page.
 */

// Balises conservees (sans aucun attribut). Couvre l'inline sur + les structures
// gerees par le rendu (titres, listes, tableaux, blocs).
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'br',
  'p', 'div', 'span', 'hr', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
]);

export function sanitizeStoredHtml(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) return '';
  let s = input;

  // 1. Elements dangereux + contenu (y compris balise de fermeture facultative).
  s = s.replace(
    /<(script|style|iframe|object|embed|svg|math|template|noscript)\b[\s\S]*?(?:<\/\1\s*>|$)/gi,
    '',
  );

  // 2. Commentaires HTML.
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // 3. Liste blanche de balises, TOUS attributs supprimes. Toute balise inconnue
  //    (img, a, input, form, ...) est retiree entierement.
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_m, slash: string, tag: string) => {
    const t = tag.toLowerCase();
    return ALLOWED_TAGS.has(t) ? `<${slash}${t}>` : '';
  });

  // 4. Retire une balise TRONQUEE en toute fin de chaine (sans `>`), ex.
  //    « <img src=x onerror=… » : les navigateurs l'ignorent deja (eof-in-tag),
  //    mais on la supprime pour ne rien stocker de suspect.
  s = s.replace(/<\/?[a-zA-Z][^>]*$/g, '');

  return s;
}
