/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rafraîchissement par tirage vers le bas (style TikTok/WhatsApp). Quand le
 * contenu est en haut et qu'on tire vers le bas au-delà d'un seuil, on déclenche
 * `onRefresh`. Devient le conteneur de défilement de la zone qu'il enveloppe.
 */

import React, { useRef, useState } from 'react';
import { Feather } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  className?: string;
  children: React.ReactNode;
}

const THRESHOLD = 72; // distance (px) à atteindre pour déclencher

export default function PullToRefresh({ onRefresh, className = '', children }: PullToRefreshProps) {
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const el = ref.current;
    if (!el || refreshing) { pulling.current = false; return; }
    // On ne démarre le geste que si on est tout en haut du contenu.
    if (el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    } else {
      pulling.current = false;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPull(Math.min(dy * 0.5, 96)); // résistance élastique
    } else {
      setPull(0);
      pulling.current = false;
    }
  };

  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      ref={ref}
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Indicateur (plume) */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: pull, transition: pulling.current ? 'none' : 'height 0.2s ease' }}
      >
        <Feather
          className={`w-6 h-6 text-purple-600 ${refreshing ? 'animate-spin' : ''}`}
          style={{
            opacity: Math.min(1, pull / 36),
            transform: refreshing ? undefined : `rotate(${pull * 3}deg) scale(${0.6 + progress * 0.4})`,
          }}
        />
      </div>
      {children}
    </div>
  );
}
