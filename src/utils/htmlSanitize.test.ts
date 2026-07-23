/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import { sanitizeStoredHtml } from './htmlSanitize';

describe('sanitizeStoredHtml', () => {
  it('conserve les balises inline sures', () => {
    expect(sanitizeStoredHtml('<b>gras</b> <em>ital</em><br>')).toBe('<b>gras</b> <em>ital</em><br>');
  });

  it('conserve les balises de structure (sans attribut)', () => {
    expect(sanitizeStoredHtml('<p class="x">a</p><h2 id="y">t</h2><li>e</li>'))
      .toBe('<p>a</p><h2>t</h2><li>e</li>');
  });

  it('supprime entierement les scripts et leur contenu', () => {
    expect(sanitizeStoredHtml('avant<script>alert(1)</script>apres')).toBe('avantapres');
  });

  it('supprime les blocs style/iframe/svg', () => {
    expect(sanitizeStoredHtml('<style>*{x}</style><iframe src="e"></iframe>ok')).toBe('ok');
  });

  it('neutralise les gestionnaires d\'evenements en supprimant les attributs', () => {
    expect(sanitizeStoredHtml('<b onclick="steal()">x</b>')).toBe('<b>x</b>');
  });

  it('retire les balises non autorisees comme img (avec onerror)', () => {
    expect(sanitizeStoredHtml('<img src=x onerror=alert(1)>texte')).toBe('texte');
  });

  it('retire les liens javascript:', () => {
    expect(sanitizeStoredHtml('<a href="javascript:alert(1)">clic</a>')).toBe('clic');
  });

  it('retire une balise dangereuse tronquee en fin de chaine', () => {
    // `<img ...` sans `>` : la balise tronquee est supprimee (aucune injection).
    const out = sanitizeStoredHtml('fin <img src=x onerror=alert(1)');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror');
    expect(out).toBe('fin ');
  });

  it('supprime les commentaires HTML', () => {
    expect(sanitizeStoredHtml('a<!-- <script>x</script> -->b')).toBe('ab');
  });

  it('gere les entrees vides ou non-chaines', () => {
    expect(sanitizeStoredHtml('')).toBe('');
    expect(sanitizeStoredHtml(null as any)).toBe('');
    expect(sanitizeStoredHtml(undefined as any)).toBe('');
  });
});
