import React from 'react';

interface VerifiedBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tooltipText?: string;
}

export function VerifiedBadge({ 
  className = '', 
  size = 'md', 
  tooltipText = "Compte certifié (Conformité d’accomplissements de l'archipel PLUME)" 
}: VerifiedBadgeProps) {
  // Twitter / X verified badge SVG styling
  // Standard blue is #1d9bf0 (Twitter primary blue)
  const sizeClasses = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-4.5 h-4.5',
    lg: 'w-5.5 h-5.5',
  };

  return (
    <div className={`relative group inline-flex items-center justify-center cursor-help select-none ${className}`}>
      <svg 
        viewBox="0 0 24 24" 
        className={`${sizeClasses[size]} text-purple-600 fill-current shrink-0`}
        aria-label="Compte certifié"
      >
        <g>
          <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.99-3.818-3.99-.48 0-.94.1-1.348.27C14.825 2.515 13.512 1.5 12 1.5s-2.825 1.015-3.422 2.28c-.407-.17-.867-.27-1.348-.27-2.108 0-3.818 1.78-3.818 3.99 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 3.99 3.818 3.99.48 0 .94-.1 1.348-.27.597 1.265 1.91 2.28 3.422 2.28s2.825-1.015 3.422-2.28c.407.17.867.27 1.348.27 2.108 0 3.818-1.78 3.818-3.99 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6zm-12.5 4l-4.25-4.25 1.4-1.4 2.85 2.85 6.85-6.85 1.4 1.4-8.25 8.25z" />
        </g>
      </svg>
      
      {/* Tooltip to match Twitter/X professional verification card */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block z-50 bg-black text-[10px] text-zinc-150 p-2.5 rounded-xl shadow-xl border border-purple-900/40 leading-normal text-center select-none animate-fade-in font-sans">
        <div className="font-bold text-white mb-0.5 mb-1 flex items-center justify-center gap-1">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-purple-600 fill-current">
            <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.99-3.818-3.99-.48 0-.94.1-1.348.27C14.825 2.515 13.512 1.5 12 1.5s-2.825 1.015-3.422 2.28c-.407-.17-.867-.27-1.348-.27-2.108 0-3.818 1.78-3.818 3.99 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 3.99 3.818 3.99.48 0 .94-.1 1.348-.27.597 1.265 1.91 2.28 3.422 2.28s2.825-1.015 3.422-2.28c.407.17.867.27 1.348.27 2.108 0 3.818-1.78 3.818-3.99 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6zm-12.5 4l-4.25-4.25 1.4-1.4 2.85 2.85 6.85-6.85 1.4 1.4-8.25 8.25z" />
          </svg>
          Compte Certifié
        </div>
        {tooltipText}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-black rotate-45 border-r border-b border-zinc-800/85 -mt-1" />
      </div>
    </div>
  );
}
