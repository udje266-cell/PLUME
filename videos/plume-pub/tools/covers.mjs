// Couvertures des livres de DÉMONSTRATION (illustrations vectorielles + typo),
// rendues en PNG 1200x1800. Avatars des personnages fictifs en SVG.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire('/home/user/PLUME/package.json');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const DEMO = path.resolve('assets/demo');

const fonts = `<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;1,500&family=Cormorant+Garamond:ital,wght@0,600;1,500&family=Bebas+Neue&family=Inter:wght@500;700&display=swap" rel="stylesheet">`;
const base = `*{margin:0;box-sizing:border-box}body{width:600px;height:900px;overflow:hidden;position:relative;font-family:'Playfair Display',serif}
.author{position:absolute;left:0;right:0;text-align:center;font:600 15px/1 'Inter',sans-serif;letter-spacing:.42em;text-transform:uppercase}
.grain{position:absolute;inset:0;opacity:.18;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E")}`;

const covers = {
  cartographe: `<style>body{background:linear-gradient(180deg,#0b2a3a 0%,#0f4c5c 55%,#1b6a72 100%)}
  .t{position:absolute;top:118px;left:40px;right:40px;text-align:center;color:#f3d48a;font:800 62px/1.02 'Playfair Display';letter-spacing:-.01em}
  .s{position:absolute;top:66px;left:0;right:0;text-align:center;color:#f3d48a;font:italic 500 26px 'Cormorant Garamond'}</style>
  <svg width="600" height="900" style="position:absolute;inset:0">
   <g fill="none" stroke="#f3d48a" stroke-opacity=".35" stroke-width="1.6">${Array.from({ length: 9 }, (_, i) => `<path d="M-20 ${470 + i * 34} C 120 ${430 + i * 30}, 260 ${520 + i * 28}, 380 ${470 + i * 30} S 560 ${430 + i * 34}, 640 ${470 + i * 30}"/>`).join('')}</g>
   <polygon points="300,330 255,900 345,900" fill="#f3d48a" opacity=".13"/>
   <path d="M282 520 L318 520 L328 700 L272 700 Z" fill="#0a1f2a"/><rect x="276" y="498" width="48" height="26" fill="#0a1f2a"/><circle cx="300" cy="510" r="11" fill="#ffe7a8"/>
   <path d="M150 512 L300 510 L450 508" stroke="#ffe7a8" stroke-opacity=".5" stroke-width="3"/>
   <path d="M0 700 Q150 670 300 700 T600 700 V900 H0Z" fill="#082230"/><path d="M0 760 Q150 735 300 760 T600 760 V900 H0Z" fill="#061a24"/>
   ${Array.from({ length: 6 }, (_, i) => `<circle cx="${80 + i * 90}" cy="${300 - (i % 2) * 40}" r="1.6" fill="#ffe7a8"/>`).join('')}
  </svg><div class="s">roman</div><div class="t">La Cartographe des Marées</div><div class="author" style="bottom:46px;color:#f3d48a">Sarah Ndiaye</div>`,

  chambre: `<style>body{background:#140c0d}.t{position:absolute;top:610px;left:0;right:0;text-align:center;color:#f5ece6;font:400 128px/0.9 'Bebas Neue';letter-spacing:.02em}.t b{color:#e63b2e;font-weight:400}</style>
  <svg width="600" height="900" style="position:absolute;inset:0"><defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2224"/><stop offset="1" stop-color="#120a0b"/></linearGradient></defs>
   <polygon points="0,0 600,0 380,250 220,250" fill="#22151a"/><polygon points="0,900 600,900 380,520 220,520" fill="#1a1012"/>
   <polygon points="0,0 220,250 220,520 0,900" fill="url(#c)"/><polygon points="600,0 380,250 380,520 600,900" fill="url(#c)"/>
   <rect x="262" y="300" width="76" height="220" fill="#e63b2e" opacity=".9"/><rect x="262" y="300" width="76" height="220" fill="none" stroke="#ffb199" stroke-opacity=".5"/>
   <text x="300" y="350" text-anchor="middle" fill="#fff" font-family="Bebas Neue" font-size="30">317</text>
   <polygon points="262,520 338,520 420,640 180,640" fill="#e63b2e" opacity=".22"/></svg>
   <div class="t">Chambre<br><b>317</b></div><div class="author" style="bottom:42px;color:#c9b6ae">Yanis Bekri</div>`,

  nuit: `<style>body{background:linear-gradient(180deg,#1d0f3a,#5a1d6b 60%,#c2416b)}.t{position:absolute;top:96px;left:44px;right:44px;color:#ffe3ee;font:italic 500 62px/1.04 'Cormorant Garamond'}</style>
  <svg width="600" height="900" style="position:absolute;inset:0"><circle cx="440" cy="400" r="70" fill="#ffd6e4" opacity=".9"/>
   ${Array.from({ length: 5 }, (_, i) => `<circle cx="160" cy="470" r="${40 + i * 34}" fill="none" stroke="#ffd6e4" stroke-opacity="${0.5 - i * 0.08}" stroke-width="2"/>`).join('')}
   <path d="M0 720 V610 h40 v-40 h30 v60 h40 v-90 h36 v70 h30 v-120 h44 v130 h30 v-60 h50 v80 h34 v-150 h40 v150 h40 v-70 h46 v40 h40 v-90 h40 V720Z" fill="#160a28"/><rect y="720" width="600" height="180" fill="#160a28"/>
   ${Array.from({ length: 28 }, (_, i) => `<rect x="${(i * 53) % 560 + 20}" y="${600 + ((i * 37) % 110)}" width="5" height="7" fill="#ffc6d9" opacity=".8"/>`).join('')}</svg>
   <div class="t">Ce que la nuit m’a dit</div><div class="author" style="bottom:46px;color:#ffc6d9">Awa Traoré</div>`,

  dakar: `<style>body{background:linear-gradient(180deg,#ffd9a0,#f59a62 55%,#d9603f)}.t{position:absolute;bottom:150px;left:40px;right:40px;color:#3b1608;font:800 64px/1 'Playfair Display'}</style>
  <svg width="600" height="900" style="position:absolute;inset:0"><circle cx="300" cy="330" r="130" fill="#fff1d6"/>
   <path d="M0 470 Q150 450 300 470 T600 470 V900 H0Z" fill="#e9774b"/><path d="M0 520 Q150 500 300 520 T600 520 V900 H0Z" fill="#c9553a" opacity=".8"/>
   <path d="M90 470 C 100 360 120 300 112 250" stroke="#3b1608" stroke-width="9" fill="none"/><g fill="#3b1608"><path d="M112 250 q-60 -10 -90 30 q50 -20 90 -26z"/><path d="M112 250 q50 -40 100 -10 q-55 -10 -100 14z"/><path d="M112 250 q-20 -50 10 -90 q-5 50 -6 90z"/></g></svg>
   <div class="t">Une saison à Dakar</div><div class="author" style="bottom:56px;color:#3b1608">Awa Traoré</div>`,

  lunes: `<style>body{background:radial-gradient(circle at 50% 30%,#2b2f7a,#0b0c24 70%)}.t{position:absolute;top:600px;left:0;right:0;text-align:center;color:#e9ecff;font:400 132px/0.9 'Bebas Neue';letter-spacing:.06em}</style>
  <svg width="600" height="900" style="position:absolute;inset:0">${[[300, 300, 120, '#c9cff7'], [470, 170, 34, '#9aa3e8'], [140, 160, 22, '#b6bdf2'], [110, 470, 46, '#7d86d6'], [500, 470, 18, '#c9cff7']].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.2}" r="${r}" fill="#0b0c24" opacity=".55"/>`).join('')}
   ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 600}" cy="${(i * 61) % 560}" r="${(i % 3) * 0.6 + 0.6}" fill="#fff" opacity=".7"/>`).join('')}</svg>
   <div class="t">Neuf Lunes</div><div class="author" style="bottom:48px;color:#aab2f0">Chloé Lambert</div>`,

  sel: `<style>body{background:linear-gradient(180deg,#f7d9a8,#e8a95b)}.t{position:absolute;top:110px;left:40px;right:40px;text-align:center;color:#5a2a0c;font:800 58px/1.02 'Playfair Display'}</style>
  <svg width="600" height="900" style="position:absolute;inset:0"><circle cx="430" cy="380" r="60" fill="#fff4dc"/>
   <path d="M0 560 Q160 470 330 540 T600 520 V900H0Z" fill="#d48a42"/><path d="M0 650 Q200 560 380 640 T600 620 V900H0Z" fill="#b8692c"/><path d="M0 760 Q220 690 420 760 T600 740 V900H0Z" fill="#8f4b1d"/>
   <g fill="#5a2a0c">${[120, 200, 280].map((x, i) => `<g transform="translate(${x} ${548 - i * 8})"><ellipse cx="0" cy="0" rx="26" ry="12"/><rect x="-18" y="6" width="5" height="26"/><rect x="12" y="6" width="5" height="26"/><path d="M22 -4 q14 -16 8 -30" stroke="#5a2a0c" stroke-width="6" fill="none"/></g>`).join('')}</g></svg>
   <div class="t">Les Héritiers du Sel</div><div class="author" style="bottom:46px;color:#fff4dc">Sarah Ndiaye</div>`,

  lettres: `<style>body{background:#f6ece4}.t{position:absolute;top:150px;left:50px;right:50px;color:#7a2f45;font:italic 500 60px/1.05 'Cormorant Garamond'}</style>
  <svg width="600" height="900" style="position:absolute;inset:0"><rect x="120" y="440" width="360" height="240" fill="#fff" stroke="#e3c8c8" stroke-width="2" transform="rotate(-6 300 560)"/>
   <path d="M120 440 L300 590 L480 440" fill="none" stroke="#e3c8c8" stroke-width="2" transform="rotate(-6 300 560)"/>
   <g transform="translate(410 640) rotate(20)"><path d="M0 0 C 10 -80, -10 -160, 0 -230" stroke="#7a8f5a" stroke-width="3" fill="none"/>${[[-14, -60], [12, -110], [-10, -160], [8, -200]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="16" ry="7" fill="#9bb07a"/>`).join('')}<circle cx="0" cy="-232" r="20" fill="#d9677f"/><circle cx="0" cy="-232" r="8" fill="#f3c06b"/></g></svg>
   <div class="t">Petites lettres à personne</div><div class="author" style="bottom:56px;color:#7a2f45">Chloé Lambert</div>`,

  baobab: `<style>body{background:linear-gradient(180deg,#2a1440,#8a3b5c 55%,#f08a4b)}.t{position:absolute;top:100px;left:40px;right:40px;text-align:center;color:#ffe9d6;font:800 58px/1.02 'Playfair Display'}</style>
  <svg width="600" height="900" style="position:absolute;inset:0"><circle cx="300" cy="560" r="120" fill="#ffb26b" opacity=".85"/>
   <path d="M262 760 C 250 640 240 560 230 520 L370 520 C 360 560 350 640 338 760Z" fill="#1c0d1f"/>
   <g stroke="#1c0d1f" stroke-width="12" fill="none" stroke-linecap="round"><path d="M240 525 Q190 470 150 470"/><path d="M262 520 Q250 450 210 420"/><path d="M300 520 Q300 440 290 400"/><path d="M340 520 Q360 450 400 425"/><path d="M362 525 Q420 480 460 480"/></g>
   <rect y="760" width="600" height="140" fill="#1c0d1f"/></svg>
   <div class="t">Le Silence des Baobabs</div><div class="author" style="bottom:46px;color:#ffcfae">Yanis Bekri</div>`,

  etoiles: `<style>body{background:radial-gradient(circle at 50% 35%,#4b2a8c,#170b33 70%)}.t{position:absolute;top:120px;left:40px;right:40px;text-align:center;color:#f4ecff;font:800 58px/1.04 'Playfair Display'}</style>
  <svg width="600" height="900" style="position:absolute;inset:0">${Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 89) % 600}" cy="${(i * 53) % 700}" r="${(i % 4) * 0.7 + 0.7}" fill="#fff" opacity="${i % 7 === 0 ? 0.15 : 0.85}"/>`).join('')}
   <g transform="translate(300 640) rotate(-8)"><rect x="-120" y="-80" width="240" height="160" rx="6" fill="#2c1557" stroke="#c4a8ff" stroke-width="2"/><line x1="0" y1="-80" x2="0" y2="80" stroke="#c4a8ff" stroke-width="2"/>
   ${Array.from({ length: 5 }, (_, i) => `<line x1="-100" y1="${-50 + i * 24}" x2="-20" y2="${-50 + i * 24}" stroke="#c4a8ff" stroke-opacity=".5"/><line x1="20" y1="${-50 + i * 24}" x2="100" y2="${-50 + i * 24}" stroke="#c4a8ff" stroke-opacity=".5"/>`).join('')}</g>
   <path d="M300 560 L300 330" stroke="#f4ecff" stroke-opacity=".25" stroke-dasharray="4 8"/></svg>
   <div class="t">Ce que les étoiles taisent</div><div class="author" style="bottom:46px;color:#c4a8ff">Inès Kouassi</div>`,

  maison: `<style>body{background:linear-gradient(180deg,#0f1b2d,#22324b)}.t{position:absolute;top:96px;left:40px;right:40px;text-align:center;color:#f6e7c1;font:800 54px/1.04 'Playfair Display'}</style>
  <svg width="600" height="900" style="position:absolute;inset:0"><polygon points="140,420 300,320 460,420" fill="#0a1220"/><rect x="150" y="420" width="300" height="360" fill="#0a1220"/>
   ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<rect x="${172 + c * 56}" y="${446 + r * 82}" width="30" height="44" fill="${r === 1 && c === 3 ? '#ffd27a' : '#1d2b42'}"/>`).join('')).join('')}
   <rect x="0" y="780" width="600" height="120" fill="#070d18"/></svg>
   <div class="t">La Maison aux Mille Fenêtres</div><div class="author" style="bottom:46px;color:#f6e7c1">Inès Kouassi</div>`,
};

const avatars = { ines: ['Inès', '#a855f7', '#6d28d9'], malik: ['Malik', '#22d3ee', '#0e7490'], sarah: ['Sarah', '#f472b6', '#be185d'], yanis: ['Yanis', '#94a3b8', '#334155'], awa: ['Awa', '#fb923c', '#c2410c'], theo: ['Théo', '#4ade80', '#15803d'], chloe: ['Chloé', '#818cf8', '#4338ca'], hyde: ['hyde', '#6b7280', '#111827'] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 2 });
for (const [k, html] of Object.entries(covers)) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${base}</style></head><body>${html}<div class="grain"></div></body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(DEMO, `cover-${k}.png`) });
  console.log('cover', k);
}
await browser.close();
for (const [k, [name, a, b]] of Object.entries(avatars)) {
  await writeFile(path.join(DEMO, `avatar-${k}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" rx="150" fill="url(#g)"/><text x="150" y="196" text-anchor="middle" font-family="Georgia,serif" font-size="140" font-weight="700" fill="#fff">${name[0]}</text></svg>`);
}
console.log('avatars ok');
