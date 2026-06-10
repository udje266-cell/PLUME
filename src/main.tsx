import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// Patche window.fetch (base URL du backend + token d'auth) AVANT tout appel API.
import './utils/api';
import { initNative } from './utils/native';
import App from './App.tsx';
import './index.css';

// Initialisation native (splash, barre d'état, safe-areas) — no-op en web.
initNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
