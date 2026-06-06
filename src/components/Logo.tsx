/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import logoPlume from '../../assets/logo-plume.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'xl' }: LogoProps) {
  const sizeClass = {
  sm: 'h-39',
  md: 'h-45',
  lg: 'h-53',
  xl: 'h-61'
}[size];

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src={logoPlume}
        alt="PLUME"
        className={`${sizeClass} w-auto object-contain`}
        draggable={false}
      />
    </div>
  );
}