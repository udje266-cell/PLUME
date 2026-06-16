/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Garde-fou global : capture toute erreur de rendu React afin d'afficher un
 * écran lisible (et un bouton « Recharger ») PLUTÔT QU'UN ÉCRAN NOIR. Indispensable
 * en APK où une exception non interceptée laisse le WebView sur le fond du splash
 * (noir), sans aucune information.
 */

import React from 'react';
import { reportClientError } from '../utils/reportError';

interface State {
  error: Error | null;
  info: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Trace complète en console (visible via `chrome://inspect` / logcat).
    console.error('[PLUME] Erreur non interceptée :', error, info?.componentStack);
    this.setState({ info: info?.componentStack || '' });
    // Remontée serveur : on détecte le crash dans les logs sans capture.
    reportClientError(error, info?.componentStack || '');
  }

  private handleReload = () => {
    try {
      // On efface l'éventuel état corrompu en mémoire ; le token d'auth reste.
      window.location.reload();
    } catch {
      /* ignore */
    }
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0E0E14',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          overflow: 'auto',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🪶</div>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>Une erreur est survenue</h1>
        <p style={{ fontSize: 13, opacity: 0.7, maxWidth: 420, margin: '0 0 16px' }}>
          L'application a rencontré un problème d'affichage. Recharge la page ; si
          cela persiste, envoie-nous le message ci-dessous.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            background: '#7C3AED',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 28px',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            marginBottom: 18,
          }}
        >
          Recharger
        </button>
        <pre
          style={{
            fontSize: 11,
            textAlign: 'left',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: 12,
            maxWidth: 520,
            maxHeight: 220,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            color: '#ffb4b4',
          }}
        >
          {String(error?.message || error)}
          {info ? `\n${info.split('\n').slice(0, 6).join('\n')}` : ''}
        </pre>
      </div>
    );
  }
}
