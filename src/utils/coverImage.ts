/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Couverture par défaut GÉNÉRÉE localement (SVG embarqué) à partir du titre.
 * Toujours affichable (data-URI), contrairement aux services externes
 * (picsum / Unsplash) qui pouvaient ne pas charger (réseau / CORS / hors-ligne).
 */
export function generateCoverDataUri(title: string): string {
  const clean = (title || 'PLUME').trim();
  const initials = clean
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'P';

  // Palette choisie de façon déterministe d'après le titre (stable par récit).
  const palettes = [
    ['#7c3aed', '#4c1d95'],
    ['#2563eb', '#1e3a8a'],
    ['#db2777', '#831843'],
    ['#059669', '#064e3b'],
    ['#ea580c', '#7c2d12'],
    ['#0891b2', '#164e63'],
  ];
  let h = 0;
  for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) >>> 0;
  const [c1, c2] = palettes[h % palettes.length];

  // Titre tronqué pour rester lisible sur la couverture.
  const shown = clean.length > 42 ? clean.slice(0, 41) + '…' : clean;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/><circle cx="200" cy="225" r="92" fill="#ffffff" fill-opacity="0.12"/><text x="200" y="225" dy="0.36em" text-anchor="middle" font-family="Georgia, serif" font-size="84" font-weight="700" fill="#ffffff">${esc(initials)}</text><text x="200" y="430" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="#ffffff" fill-opacity="0.95">${esc(shown)}</text><text x="200" y="560" text-anchor="middle" font-family="Inter, sans-serif" font-size="16" letter-spacing="3" fill="#ffffff" fill-opacity="0.6">PLUME</text></svg>`;

  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
  }
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
