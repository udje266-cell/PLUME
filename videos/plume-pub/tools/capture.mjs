// Captures des VRAIS écrans de PLUME (serveur local + base de démonstration).
// Usage : node tools/capture.mjs [filtre]   (depuis videos/plume-pub)
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const require = createRequire('/home/user/PLUME/package.json');
const jwt = require('jsonwebtoken');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const BASE = 'http://127.0.0.1:3001';
const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'assets/screens');
const DEMO = path.join(ROOT, 'assets/demo');
const BOXES = process.env.BOXES_DIR || '/tmp/claude-0/-home-user-PLUME/dc9ed7da-966b-58d7-bcfc-7a4263120ca4/scratchpad/boxes';
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
let ME = 'demo-ines';
const token = (id) => jwt.sign({ userId: id }, 'plume_secret_dev_change_later', { expiresIn: '4h' });
const api = async (id, method, url, body) => {
  const r = await fetch(BASE + url, { method, headers: { Authorization: 'Bearer ' + token(id), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!r.ok) throw new Error(`${method} ${url} ${r.status}`);
  return r.json().catch(() => ({}));
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const log = [];
const shots = [];

const PROGRESS = { 'plume_book_progress_demo-ines': { 'demo-cartographe': { chapterIndex: 2, scrollRatio: 0.5, paragraphIndex: 2, percent: 31, updatedAt: new Date().toISOString() } } };
const CH1 = { 'plume_book_progress_demo-ines': { 'demo-cartographe': { chapterIndex: 0, scrollRatio: 0, paragraphIndex: 0, percent: 1, updatedAt: new Date().toISOString() } } };
async function session({ dark = false, prefs = {}, live = true } = {}) {
  prefs = { ...PROGRESS, ...prefs };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'fr-FR', timezoneId: 'Africa/Abidjan', hasTouch: false });
  await ctx.route('**/promo-demo/**', async (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    const type = name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.png') ? 'image/png' : name.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream';
    try { await route.fulfill({ contentType: type, body: await readFile(path.join(DEMO, name)) }); } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  if (!live) await ctx.route('**/api/live-reading**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await ctx.addCookies([{ name: 'plume_token', value: token(ME), url: BASE, httpOnly: true }]);
  const user = await api(ME, 'GET', '/api/auth/me');
  await ctx.addInitScript(({ user, dark, prefs }) => {
    try {
      if (!sessionStorage.getItem('promo_init')) {
        sessionStorage.setItem('promo_init', '1');
        localStorage.setItem('plume_current_user', JSON.stringify(user.user || user));
        localStorage.setItem('plume_is_logged_in', 'true');
        localStorage.setItem('plume_dark_mode', dark ? 'true' : 'false');
        for (const [k, v] of Object.entries(prefs)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    } catch {}
  }, { user, dark, prefs });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', (e) => log.push('PAGEERROR ' + e.message.slice(0, 200)));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

async function settle(page, ms = 700) {
  await page.waitForTimeout(ms);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((i) => i.offsetParent).map((i) => i.decode().catch(() => {})));
  });
}
async function shot(page, name, note = '') {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  // Boîtes des éléments visibles (px CSS ×3 = px de la capture) pour viser les zooms.
  const boxes = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim().replace(/\s+/g, ' ');
      const label = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('alt') || '';
      if (!own && !label && !el.id && !['IMG', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) continue;
      out.push({ tag: el.tagName.toLowerCase(), id: el.id || undefined, text: own.slice(0, 80) || undefined, label: label.slice(0, 80) || undefined, x: Math.round(r.left * 3), y: Math.round(r.top * 3), w: Math.round(r.width * 3), h: Math.round(r.height * 3) });
    }
    return out;
  });
  // Hors du dépôt : le serveur Vite surveille le dépôt et rechargerait la page.
  await writeFile(path.join(BOXES, name + '.boxes.json'), JSON.stringify(boxes));
  shots.push({ name, note });
  console.log('SHOT', name);
}
async function dump(page, tag) {
  const items = await page.evaluate(() => [...document.querySelectorAll('button,[role=button],a,input,textarea,select')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight; })
    .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} «${(e.getAttribute('aria-label') || e.title || e.innerText || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 50)}»`));
  console.log(`--- ${tag}\n` + items.join('\n'));
}
const nav = async (page, id) => { await page.locator('#nav-tab-' + id).click(); await page.waitForTimeout(1500); };
const topAll = (page) => page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); });

const steps = {
  async home() {
    const { ctx, page } = await session();
    await shot(page, 'home');
    await page.mouse.move(195, 500); await page.mouse.wheel(0, 520); await shot(page, 'home-scroll');
    await topAll(page); await page.locator('input[aria-label*="Rechercher"]').first().fill('lune'); await shot(page, 'home-search');
    await ctx.close();
  },
  async homedark() {
    const { ctx, page } = await session({ dark: true });
    await shot(page, 'home-dark');
    await ctx.close();
  },
  async explorer() {
    const { ctx, page } = await session();
    await page.getByRole('button', { name: /^Tout voir$/ }).first().click(); await page.waitForTimeout(1500);
    await shot(page, 'explorer');
    const sel = page.locator('select').first(); await sel.selectOption({ label: 'Fantasy' }).catch(async () => { await dump(page, 'explorer'); });
    await shot(page, 'explorer-fantasy');
    await ctx.close();
  },
  async detail() {
    const { ctx, page } = await session({ prefs: { 'plume_book_progress_demo-ines': {} }, live: false });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(1500);
    await shot(page, 'detail');
    await ctx.close();
  },
  async readerprobe() {
    const { ctx, page } = await session({ prefs: CH1, live: false });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500);
    await topAll(page);
    await shot(page, 'reader');
    await dump(page, 'reader');
    await page.getByRole('button', { name: 'Réglages d’affichage' }).click(); await page.waitForTimeout(800);
    await shot(page, 'reader-settings');
    await dump(page, 'settings');
    await ctx.close();
  },
  async reader2() {
    const run = async (theme, cb) => {
      const { ctx, page } = await session({ prefs: { ...CH1, 'plume_reading_prefs_demo-ines': { theme } }, live: false });
      await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500); await topAll(page);
      await cb(page); await ctx.close();
    };
    await run('light', (page) => shot(page, 'reader-clair'));
    await run('oled', async (page) => { await shot(page, 'reader-oled'); await page.getByRole('button', { name: 'Réglages d’affichage' }).click(); await page.waitForTimeout(800); await shot(page, 'reader-settings-oled'); });
    await run('sepia', async (page) => { await shot(page, 'reader-sepia'); await page.getByRole('button', { name: 'Lancer le défilement automatique' }).click(); await page.waitForTimeout(1800); await shot(page, 'reader-autoscroll'); });
  },
  async audio() {
    const { ctx, page } = await session({ prefs: CH1, live: false });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500); await topAll(page);
    await page.getByRole('button', { name: 'Ouvrir le livre audio' }).click(); await page.waitForTimeout(1200);
    await shot(page, 'audio'); await dump(page, 'audio');
    await ctx.close();
  },
  async download() {
    const { ctx, page } = await session({ prefs: CH1, live: false });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500); await topAll(page);
    await page.locator('#reader-download-btn').click(); await page.waitForTimeout(400); await shot(page, 'download');
    await page.waitForTimeout(1500); await shot(page, 'download-done');
    await ctx.close();
  },
  async passages() {
    const { ctx, page } = await session({ prefs: CH1, live: false });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500); await topAll(page);
    await page.locator('#p-idx-3').scrollIntoViewIfNeeded(); await page.mouse.wheel(0, -120); await page.waitForTimeout(400);
    await page.locator('#p-idx-3').click(); await page.waitForTimeout(700);
    await shot(page, 'passage-tools'); await dump(page, 'passage');
    await page.getByTitle('Surligner ce passage (visible par toi seul)', { exact: true }).filter({ visible: true }).click().catch((e) => log.push('surligner ' + e.message.slice(0, 80)));
    await page.waitForTimeout(700); await shot(page, 'passage-highlight'); await dump(page, 'highlight');
    await page.getByTitle('Ajouter une note personnelle', { exact: true }).filter({ visible: true }).click().catch((e) => log.push('note ' + e.message.slice(0, 80)));
    await page.waitForTimeout(700); await shot(page, 'passage-note');
    await ctx.close();
  },
  async comments() {
    const { ctx, page } = await session({ prefs: CH1, live: false });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500); await topAll(page);
    await page.locator('#p-idx-2').scrollIntoViewIfNeeded();
    await page.locator('#p-idx-2').getByRole('button', { name: /Voir les \d+ commentaires/ }).click(); await page.waitForTimeout(1200);
    await shot(page, 'comments');
    await ctx.close();
  },
  async library() {
    const { ctx, page } = await session();
    await nav(page, 'library'); await shot(page, 'library');
    await page.mouse.move(195, 500); await page.mouse.wheel(0, 640); await shot(page, 'library-collections');
    await page.getByRole('button', { name: 'Vue en liste' }).click(); await page.mouse.wheel(0, 300); await shot(page, 'library-list');
    await ctx.close();
  },
  async messages() {
    const { ctx, page } = await session();
    await nav(page, 'messages'); await shot(page, 'inbox');
    await page.locator('[id^="chat-partner-select-demo-malik"], button:has-text("Malik Diallo")').first().click(); await page.waitForTimeout(2000);
    await shot(page, 'chat'); await dump(page, 'chat');
    await page.getByRole('button', { name: /spoiler/i }).first().click().catch((e) => log.push('spoiler ' + e.message.slice(0, 60))); await page.waitForTimeout(600);
    await shot(page, 'chat-reveal');
    await ctx.close();
  },
  async club() {
    const { ctx, page } = await session();
    await nav(page, 'messages');
    await page.getByRole('button', { name: /^Clubs de lecture/ }).click(); await page.waitForTimeout(1000);
    await shot(page, 'clubs');
    await page.locator('button', { hasText: 'Les Nuits Blanches' }).first().click(); await page.waitForTimeout(2500);
    await shot(page, 'club'); await dump(page, 'club');
    await page.mouse.move(195, 500); await page.mouse.wheel(0, -900); await page.waitForTimeout(600); await shot(page, 'club-top');
    await ctx.close();
  },
  async profile() {
    const { ctx, page } = await session();
    await nav(page, 'profile'); await topAll(page); await shot(page, 'profile');
    await page.mouse.move(195, 500); await page.mouse.wheel(0, 700); await shot(page, 'profile-journey');
    await page.getByText(/Voir mes trophées et légendes/).first().click().catch(() => {}); await page.waitForTimeout(700);
    await page.mouse.wheel(0, 400); await shot(page, 'profile-legends');
    await page.getByRole('button', { name: /Tous mes trophées/ }).first().click().catch((e) => log.push('trophees ' + e.message.slice(0, 60))); await page.waitForTimeout(1200);
    await shot(page, 'trophies'); await dump(page, 'trophies');
    await ctx.close();
  },
  async write() {
    const { ctx, page } = await session();
    await nav(page, 'write'); await topAll(page); await shot(page, 'write');
    await page.locator('#studio-tab-stats').click(); await page.waitForTimeout(1500); await shot(page, 'stats');
    await page.evaluate(() => { const h = [...document.querySelectorAll('h3,h2,h4')].find((e) => /Parcours de lecture/i.test(e.textContent)); h?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -130); }); await shot(page, 'stats-funnel');
    await page.locator('#studio-tab-books').click(); await page.waitForTimeout(800);
    await page.locator('#add-story-studio-btn').click(); await page.waitForTimeout(1200);
    await dump(page, 'create');
    await page.locator('#create-story-title').fill('Ce que les étoiles taisent').catch((e) => log.push('title ' + e.message.slice(0, 60)));
    await page.locator('#create-story-description').fill('Chaque nuit, une étoile s’éteint au-dessus d’Abidjan. Nadia est la seule à le remarquer.').catch(() => {});
    await shot(page, 'create'); await page.mouse.move(195, 500); await page.mouse.wheel(0, 700); await shot(page, 'create-2');
    await ctx.close();
  },
  async workshop() {
    const { ctx, page } = await session();
    await nav(page, 'write'); await topAll(page);
    await page.locator('#manage-chapters-studio-demo-etoiles').click(); await page.waitForTimeout(1500);
    await shot(page, 'workshop'); await dump(page, 'workshop');
    await page.locator('#btn-edit-chapter-demo-etoiles-ch4').click().catch((e) => log.push('editch ' + e.message.slice(0, 60))); await page.waitForTimeout(2000);
    await shot(page, 'editor'); await dump(page, 'editor');
    const ed = page.locator('[contenteditable=true]').first();
    await ed.press('ControlOrMeta+End'); await ed.press('Enter');
    await ed.pressSequentially('Au loin, une étoile clignota deux fois, comme un signal. Nadia comprit qu’elle n’était plus seule à veiller.', { delay: 8 });
    await page.waitForTimeout(500); await shot(page, 'editor-written');
    await page.getByRole('button', { name: 'Assistant d\'écriture IA' }).click(); await page.waitForTimeout(1000);
    await shot(page, 'ai-menu'); await dump(page, 'ai');
    await ctx.close();
  },
  async ambience() {
    const { ctx, page } = await session({ prefs: CH1, live: false });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500); await topAll(page);
    await page.getByRole('button', { name: 'Réglages d’affichage' }).click(); await page.waitForTimeout(700);
    const amb = page.getByText('Ambiance sonore').first(); await amb.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    await page.evaluate(() => { const el = [...document.querySelectorAll('p')].find((p) => p.textContent.includes('Ambiance sonore')); el?.scrollIntoView({ block: 'center' }); });
    await page.getByRole('button', { name: /Pluie/ }).first().click().catch((e) => log.push('pluie ' + e.message.slice(0, 60)));
    await page.waitForTimeout(600); await shot(page, 'ambience'); await dump(page, 'ambience');
    await ctx.close();
  },
  async plumecard() {
    const { ctx, page } = await session({ prefs: CH1, live: false });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500); await topAll(page);
    await page.evaluate(() => document.getElementById('p-idx-3')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(500);
    await page.locator('#p-idx-3').click({ position: { x: 60, y: 20 } }); await page.waitForTimeout(700);
    await page.getByTitle('Créer une PlumeCard (Lyricard)', { exact: true }).filter({ visible: true }).click();
    await page.waitForTimeout(1500); await shot(page, 'plumecard'); await dump(page, 'plumecard');
    await ctx.close();
  },
  async club() {
    for (const [k, ch, pct, para] of [['malik', 1, 74, 5], ['theo', 2, 38, 2], ['awa', 1, 92, 7]]) await api('demo-' + k, 'POST', `/api/chapters/demo-cartographe-ch${ch}/progress`, { progressPercent: pct, paragraphIndex: para }).catch((e) => log.push('progress ' + e.message));
    const { ctx, page } = await session();
    await nav(page, 'messages'); await dump(page, 'inbox-club');
    await page.locator('button', { hasText: /Clubs de lecture/ }).filter({ visible: true }).first().click(); await page.waitForTimeout(1500);
    await shot(page, 'clubs'); await dump(page, 'clubs');
    await page.locator('button', { hasText: 'Les Nuits Blanches' }).filter({ visible: true }).first().click(); await page.waitForTimeout(3000);
    await shot(page, 'club'); await dump(page, 'club');
    await page.mouse.move(195, 500); await page.mouse.wheel(0, -1200); await page.waitForTimeout(800); await shot(page, 'club-top');
    await ctx.close();
  },
  async chat2() {
    const { ctx, page } = await session();
    await nav(page, 'messages');
    await page.getByRole('button', { name: 'Ouvrir la discussion avec Malik Diallo' }).first().click(); await page.waitForTimeout(2000);
    await shot(page, 'chat');
    const sp = page.getByRole('button', { name: 'Toucher pour révéler le spoiler' }).filter({ visible: true }).last();
    await sp.scrollIntoViewIfNeeded(); await sp.click({ force: true }).catch((e) => log.push('spoiler ' + e.message.slice(0, 60))); await page.waitForTimeout(900);
    await shot(page, 'chat-reveal');
    await ctx.close();
  },
  async trophies() {
    const { ctx, page } = await session();
    await nav(page, 'profile'); await topAll(page); await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^Magnifique/i }).click().catch(() => {}); await page.waitForTimeout(600);
    await page.getByText(/Voir mes trophées et légendes/).first().click().catch(() => {}); await page.waitForTimeout(700);
    await page.getByRole('button', { name: /Tous mes trophées/ }).first().click().catch((e) => log.push('trophees ' + e.message.slice(0, 60))); await page.waitForTimeout(1200);
    await shot(page, 'trophies'); await page.mouse.move(195, 500); await page.mouse.wheel(0, 600); await shot(page, 'trophies-2');
    await ctx.close();
  },
  async publish() {
    const { ctx, page } = await session();
    await nav(page, 'write'); await topAll(page);
    await page.locator('#manage-chapters-studio-demo-etoiles').click(); await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /Mettre en ligne/ }).last().click(); await page.waitForTimeout(1500);
    await shot(page, 'published'); await dump(page, 'published');
    await ctx.close();
  },
  async malik() {
    ME = 'demo-malik';
    try {
      const { ctx, page } = await session();
      const { execSync } = await import('node:child_process');
      const sql = '/tmp/claude-0/-home-user-PLUME/dc9ed7da-966b-58d7-bcfc-7a4263120ca4/scratchpad/dedupe.sql';
      await writeFile(sql, `DELETE FROM "Notification" a USING "Notification" b WHERE a."userId"='demo-malik' AND b."userId"='demo-malik' AND a.type=b.type AND a.message=b.message AND a.id > b.id;`);
      execSync(`PGPASSWORD=plume psql -h localhost -U plume -d plume_promo -q -f ${sql}`);
      await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
      await page.locator('#notifications-bell-btn').click(); await shot(page, 'notif-malik');
      await ctx.close();
    } finally { ME = 'demo-ines'; }
  },
  async probe() {
    const { ctx, page } = await session({ prefs: { ...CH1, 'plume_reading_prefs_demo-ines': { theme: 'oled' } }, live: false });
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('NAV', f.url()); });
    page.on('console', (m) => { if (/error|warn/.test(m.type()) && !/vibrate|WebSocket|React/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 150)); });
    await page.getByRole('button', { name: /^Découvrir/ }).first().click(); await page.waitForTimeout(2500);
    console.log('before topAll', await page.evaluate(() => !!document.querySelector('#reader-back-btn')));
    await topAll(page); console.log('after topAll', await page.evaluate(() => !!document.querySelector('#reader-back-btn')));
    await settle(page); console.log('after settle', await page.evaluate(() => !!document.querySelector('#reader-back-btn')));
    await shot(page, 'probe-a'); console.log('after shot', await page.evaluate(() => !!document.querySelector('#reader-back-btn')));
    await page.getByRole('button', { name: 'Réglages d’affichage' }).click(); console.log('after click');
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); console.log('t', (i + 1) * 0.5, await page.evaluate(() => !!document.querySelector('#reader-back-btn'))); }
    await ctx.close();
  },
  async notifications() {
    const { ctx, page } = await session();
    await page.locator('#notifications-bell-btn').click(); await shot(page, 'notifications');
    await ctx.close();
  },
};

for (const [name, fn] of Object.entries(steps)) {
  if (only && !only.test(name)) continue;
  try { await fn(); } catch (e) { log.push(`STEP ${name} FAILED: ${e.message.split('\n')[0]}`); }
}
await browser.close();
const prev = JSON.parse(await readFile(path.join(ROOT, 'CAPTURES.json'), 'utf8').catch(() => '{"shots":[]}'));
const merged = [...prev.shots.filter((s) => !shots.find((n) => n.name === s.name)), ...shots];
await writeFile(path.join(ROOT, 'CAPTURES.json'), JSON.stringify({ source: 'PLUME (code du dépôt) servi en local sur une base de démonstration', viewport: '390x844 @3x', shots: merged }, null, 2));
console.log(log.length ? 'LOG:\n' + log.join('\n') : 'LOG: clean');
