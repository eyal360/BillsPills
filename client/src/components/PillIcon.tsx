import React from 'react';

interface Props {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const PillIcon: React.FC<Props> = ({ size = 48, className = '', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ ...style, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>
    <defs>
      {/* Matte colors from reference image */}
      <linearGradient id="pillRed" x1="30" y1="50" x2="70" y2="10" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#D44D4A" />
        <stop offset="100%" stopColor="#E35855" />
      </linearGradient>
      <linearGradient id="pillGreen" x1="30" y1="50" x2="70" y2="90" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#59B185" />
        <stop offset="100%" stopColor="#489E73" />
      </linearGradient>

      {/* Dense Pattern for ILS symbols to match reference (approx 5.5 across width) */}
      <pattern id="ilsPattern" x="0" y="0" width="7.2" height="7.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-45 50 50)">
         <text x="3.6" y="5.5" fontSize="5.5" fontWeight="800" fill="rgba(0,0,0,0.12)" textAnchor="middle" style={{ userSelect: 'none' }}>₪</text>
      </pattern>
      
      {/* Gloss and Shadow Overlay to give a soft 3D effect */}
      <linearGradient id="pillGloss" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="white" stopOpacity="0.25" />
        <stop offset="30%" stopColor="white" stopOpacity="0" />
        <stop offset="70%" stopColor="black" stopOpacity="0" />
        <stop offset="100%" stopColor="black" stopOpacity="0.25" />
      </linearGradient>
    </defs>

    <g transform="rotate(45 50 50)">
      {/* Background shapes */}
      <path d="M30 50 L30 30 A20 20 0 0 1 70 30 L70 50 Z" fill="url(#pillRed)" />
      <path d="M30 50 L30 70 A20 20 0 0 0 70 70 L70 50 Z" fill="url(#pillGreen)" />
      
      {/* The ILS pattern overlay over the entire pill */}
      <path d="M30 30 A20 20 0 0 1 70 30 L70 70 A20 20 0 0 1 30 70 Z" fill="url(#ilsPattern)" />

      {/* Middle split line for pill indent */}
      <line x1="30" y1="50" x2="70" y2="50" stroke="rgba(0,0,0,0.15)" strokeWidth="1" pointerEvents="none" />
      <line x1="30" y1="51" x2="70" y2="51" stroke="rgba(255,255,255,0.15)" strokeWidth="1" pointerEvents="none" />

      {/* Gloss and Shadow Overlay covering the whole pill */}
      <path d="M30 30 A20 20 0 0 1 70 30 L70 70 A20 20 0 0 1 30 70 Z" fill="url(#pillGloss)" pointerEvents="none" />

      {/* Subtle inner stroke highlight for depth */}
      <path d="M30 30 A20 20 0 0 1 70 30 L70 70 A20 20 0 0 1 30 70 Z" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" pointerEvents="none" />
      {/* Outer rim shadow on the bottom right (unrotated perspective) */}
      <path d="M68 50 L68 70 A18 18 0 0 1 32 70" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeLinecap="round" fill="none" pointerEvents="none" />

      {/* Classic pill glossy shine */}
      <path d="M36 28 L36 58" stroke="rgba(255,255,255,0.3)" strokeWidth="3.5" strokeLinecap="round" pointerEvents="none" />
      <path d="M36 63.5 L36 66" stroke="rgba(255,255,255,0.3)" strokeWidth="3.5" strokeLinecap="round" pointerEvents="none" />
    </g>
  </svg>
);
