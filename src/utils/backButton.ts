/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bouton retour physique Android pour les SURCOUCHES (éditeur, modals…).
 *
 * App dispatch un CustomEvent('plume-back') annulable AVANT son comportement
 * global : le composant monté le plus « haut » intercepte l'événement, ferme
 * son overlay et consomme le retour. Sur le web, l'événement n'est jamais
 * émis : ce hook est inerte (zéro impact).
 */

import { useEffect, useRef } from 'react';

/**
 * Intercepte le retour Android tant que le composant est monté.
 * `handler()` doit retourner true si le retour a été consommé (un overlay
 * s'est fermé) ; false pour laisser la main aux autres écouteurs puis à App.
 */
export function useAndroidBack(handler: () => boolean): void {
  // Réf pour toujours exécuter la DERNIÈRE version du handler sans se
  // réabonner à chaque rendu (l'ordre d'abonnement resterait sinon instable).
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onBack = (e: Event) => {
      if (e.defaultPrevented) return; // déjà consommé par un overlay plus haut
      if (handlerRef.current()) e.preventDefault();
    };
    window.addEventListener('plume-back', onBack);
    return () => window.removeEventListener('plume-back', onBack);
  }, []);
}
