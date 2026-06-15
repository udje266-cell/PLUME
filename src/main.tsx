import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// Patche window.fetch (base URL du backend + token d'auth) AVANT tout appel API.
import './utils/api';
import { initNative } from './utils/native';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Initialisation native (splash, barre d'état, safe-areas) — no-op en web.
initNative();

// Filet de sécurité GLOBAL : une erreur d'init de module ou une promesse rejetée
// (hors rendu React) laisserait sinon le WebView sur l'écran noir du splash. Si
// la racine reste vide après une erreur, on affiche un message lisible.
function showFatal(message: string) {
  const root = document.getElementById('root');
  if (!root || root.childElementCount > 0) return; // l'app a déjà rendu : on n'écrase rien
  root.innerHTML =
    '<div style="position:fixed;inset:0;background:#0E0E14;color:#fff;display:flex;' +
    'flex-direction:column;align-items:center;justify-content:center;padding:24px;' +
    'text-align:center;font-family:system-ui,sans-serif">' +
    '<div style="font-size:40px;margin-bottom:12px">🪶</div>' +
    '<h1 style="font-size:18px;font-weight:800;margin:0 0 8px">Démarrage impossible</h1>' +
    '<p style="font-size:13px;opacity:.7;max-width:420px;margin:0 0 16px">' +
    'Recharge l\'application ; si cela persiste, envoie-nous ce message.</p>' +
    '<button onclick="window.location.reload()" style="background:#7C3AED;color:#fff;' +
    'border:none;border-radius:12px;padding:12px 28px;font-size:14px;font-weight:800">Recharger</button>' +
    '<pre style="font-size:11px;text-align:left;background:rgba(255,255,255,.06);' +
    'border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px;max-width:520px;' +
    'margin-top:18px;max-height:200px;overflow:auto;white-space:pre-wrap;color:#ffb4b4"></pre></div>';
  const pre = root.querySelector('pre');
  if (pre) pre.textContent = message;
}
window.addEventListener('error', (e) => showFatal(String(e?.error?.stack || e?.message || e)));
window.addEventListener('unhandledrejection', (e) => showFatal(String((e as any)?.reason?.stack || (e as any)?.reason || 'Promesse rejetée')));

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (e: any) {
  showFatal(String(e?.stack || e?.message || e));
}
