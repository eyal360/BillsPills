import React from 'react';

interface Props {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

// Custom Shekel (₪) Path
const ShekelPath = "M4.5 2C2.01472 2 0 4.01472 0 6.5V11H2V6.5C2 5.11929 3.11929 4 4.5 4H8V2H4.5ZM13.5 13C15.9853 13 18 10.9853 18 8.5V4H16V8.5C16 9.88071 14.8807 11 13.5 11H10V13H13.5Z";

export const PillIcon: React.FC<Props> = ({ size = 48, className = '', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ ...style, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }}>
    <defs>
      <linearGradient id="pillPastelRed" x1="30" y1="50" x2="70" y2="10">
        <stop offset="0%" stopColor="#FB7185" />
        <stop offset="100%" stopColor="#F43F5E" />
      </linearGradient>
      <linearGradient id="pillPastelGreen" x1="30" y1="50" x2="70" y2="90">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
      
      <linearGradient id="greenGloss" x1="50" y1="50" x2="50" y2="90" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="white" stopOpacity="0.4" />
        <stop offset="50%" stopColor="white" stopOpacity="0" />
      </linearGradient>

      {/* Improved Pattern for ILS symbols */}
      <pattern id="ilsPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
         <g transform="translate(1, 4) scale(0.6)">
           <path d={ShekelPath} fill="rgba(255,255,255,0.25)" />
         </g>
      </pattern>
    </defs>

    <g transform="rotate(45 50 50)">
      <path d="M30 50 L30 30 A20 20 0 0 1 70 30 L70 50 Z" fill="url(#pillPastelRed)" />
      <path d="M30 50 L30 70 A20 20 0 0 0 70 70 L70 50 Z" fill="url(#pillPastelGreen)" />
      
      {/* Increased Pattern visibility */}
      <path d="M30 30 A20 20 0 0 1 70 30 L70 70 A20 20 0 0 1 30 70 Z" fill="url(#ilsPattern)" pointerEvents="none" />

      <path d="M35 55 A15 15 0 0 0 65 55 L65 75 A15 15 0 0 1 35 75 Z" fill="url(#greenGloss)" opacity="0.4" pointerEvents="none" />

      <path d="M42 22 A12 12 0 0 1 61 29" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <path d="M43 25 A8 8 0 0 1 56 30" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
    </g>
  </svg>
);
