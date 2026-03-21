import React from 'react';

interface Props {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const PillIcon: React.FC<Props> = ({ size = 48, className = '', style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} style={{ ...style, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))' }}>
    <g transform="rotate(45 50 50)">
      {/* Red half (Top) */}
      <path d="M30 50 L30 30 A20 20 0 0 1 70 30 L70 50 Z" fill="url(#pillRedGrad)" />
      {/* Green half (Bottom) */}
      <path d="M30 50 L30 70 A20 20 0 0 0 70 70 L70 50 Z" fill="url(#pillGreenGrad)" />
      {/* Plastic reflection highlights */}
      <path d="M42 22 A12 12 0 0 1 61 29" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <path d="M42 26 A8 8 0 0 1 54 30" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </g>
    <defs>
      <linearGradient id="pillRedGrad" x1="30" y1="50" x2="70" y2="10">
        <stop offset="0%" stopColor="#f43f5e" /> {/* rose-500 */}
        <stop offset="100%" stopColor="#e11d48" /> {/* rose-600 */}
      </linearGradient>
      <linearGradient id="pillGreenGrad" x1="30" y1="50" x2="70" y2="90">
        <stop offset="0%" stopColor="#4ade80" /> {/* green-400 */}
        <stop offset="100%" stopColor="#16a34a" /> {/* green-600 */}
      </linearGradient>
    </defs>
  </svg>
);
