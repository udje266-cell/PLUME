/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import logoPlume from '../../assets/logo-plume.png';
import logoPlumeDark from '../../assets/logo-plume-dark.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  // Forcer la variante au wordmark CLAIR (pour un fond sombre/coloré, ex. le
  // panneau violet de la page de connexion) quel que soit le thème courant.
  onDark?: boolean;
}

export default function Logo({ className = '', size = 'xl', onDark = false }: LogoProps) {
  const sizeClass = {
    sm: 'h-[64px]',
    md: 'h-[88px]',
    lg: 'h-[112px]',
    xl: 'h-[140px]',
    '2xl': 'h-[200px]',
  }[size];

  // Sur un fond sombre/coloré, on affiche TOUJOURS le logo à texte clair
  // (le wordmark navy serait illisible sur le violet).
  if (onDark) {
    return (
      <div className={`flex items-center select-none ${className}`}>
        <img
          src={logoPlumeDark}
          alt="PLUME"
          className={`${sizeClass} w-auto object-contain block`}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none ${className}`}>
      {/* Le wordmark « PLUME » du logo est en navy foncé : invisible en mode
          sombre. On bascule donc sur une variante au texte clair via la classe
          `dark` (la plume colorée reste identique dans les deux variantes). */}
      <img
        src={logoPlume}
        alt="PLUME"
        className={`${sizeClass} w-auto object-contain block dark:hidden`}
        draggable={false}
      />
      <img
        src={logoPlumeDark}
        alt="PLUME"
        aria-hidden="true"
        className={`${sizeClass} w-auto object-contain hidden dark:block`}
        draggable={false}
      />
    </div>
  );
}
