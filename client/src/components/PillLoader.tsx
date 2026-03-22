import React, { useState, useEffect } from 'react';
import styles from './PillLoader.module.css';

interface PillLoaderProps {
  loadingProgress?: number; // 0 to 100
  demo?: boolean;
  isCompleting?: boolean;
  onComplete?: () => void;
  hideLabel?: boolean;
}

const ShekelPath = "M4.5 2C2.01472 2 0 4.01472 0 6.5V11H2V6.5C2 5.11929 3.11929 4 4.5 4H8V2H4.5ZM13.5 13C15.9853 13 18 10.9853 18 8.5V4H16V8.5C16 9.88071 14.8807 11 13.5 11H10V13H13.5Z";

export const PillLoader: React.FC<PillLoaderProps> = ({
  loadingProgress = 0,
  demo = false,
  isCompleting = false,
  onComplete,
  hideLabel = false
}) => {
  const [progress, setProgress] = useState(loadingProgress);

  useEffect(() => {
    if (isCompleting) {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            onComplete?.();
            return 100;
          }
          return p + 5; // Speed up to 100
        });
      }, 30);
      return () => clearInterval(interval);
    }

    if (demo) {
      const timer = setInterval(() => {
        setProgress(p => (p >= 100 ? 0 : p + 1));
      }, 50);
      return () => clearInterval(timer);
    } else {
      setProgress(loadingProgress);
    }
  }, [demo, loadingProgress, isCompleting, onComplete]);

  // House inner dimensions: peak Y=40, floor Y=170. Total height = 130.
  const fillHeight = Math.min(130, Math.max(0, (progress / 100) * 130));
  const fillY = 170 - fillHeight;

  return (
    <div className={styles.container}>
      <svg
        className={styles.loaderSvg}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="loaderPastelRed" x1="30" y1="50" x2="70" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>
          <linearGradient id="loaderPastelGreen" x1="30" y1="50" x2="70" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="loaderGreenGloss" x1="50" y1="50" x2="50" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="50%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <pattern id="loaderIlsPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <g transform="translate(2, 4) scale(0.6)">
              <path d={ShekelPath} fill="rgba(255,255,255,0.3)" />
            </g>
          </pattern>

          <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(52, 211, 153, 0.7)" /> {/* emerald-400 */}
            <stop offset="100%" stopColor="rgba(16, 185, 129, 0.4)" /> {/* emerald-500 */}
          </linearGradient>

          {/* Mini Pill Centered Definition */}
          <g id="miniPillCentered">
            <g transform="translate(-50, -50)">
              <g transform="rotate(45 50 50)">
                <path d="M30 50 L30 30 A20 20 0 0 1 70 30 L70 50 Z" fill="url(#loaderPastelRed)" />
                <path d="M30 50 L30 70 A20 20 0 0 0 70 70 L70 50 Z" fill="url(#loaderPastelGreen)" style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))' }} />
                <path d="M30 30 A20 20 0 0 1 70 30 L70 70 A20 20 0 0 1 30 70 Z" fill="url(#loaderIlsPattern)" pointerEvents="none" />
                <path d="M35 55 A15 15 0 0 0 65 55 L65 75 A15 15 0 0 1 35 75 Z" fill="url(#loaderGreenGloss)" opacity="0.4" pointerEvents="none" />
                <path d="M42 22 A12 12 0 0 1 61 29" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
                <path d="M43 25 A8 8 0 0 1 56 30" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
              </g>
            </g>
          </g>

          {/* Restricting the water fill to the inner house volume */}
          <clipPath id="houseInnerClip">
            <path d="M100 40 L60 80 V170 H140 V80 Z" />
          </clipPath>
        </defs>

        <g className={styles.housePuffing}>
          {/* House Base / Liquid Glass inner fill */}
          <path d="M100 40 L60 80 V170 H140 V80 Z" fill="rgba(255,255,255,0.05)" />

          {/* Progress Bar (Liquid Fill) */}
          <rect
            x="50"
            y={fillY}
            width="100"
            height={fillHeight}
            fill="url(#waterGradient)"
            clipPath="url(#houseInnerClip)"
            className={styles.progressBar}
          />

          {/* Raining Pills */}
          <g transform="translate(85, 0)">
            <use href="#miniPillCentered" className={styles.pillAnimation} style={{ animationDelay: '0s' }} />
          </g>
          <g transform="translate(115, 0)">
            <use href="#miniPillCentered" className={styles.pillAnimation} style={{ animationDelay: '0.5s' }} />
          </g>
          <g transform="translate(100, 0)">
            <use href="#miniPillCentered" className={styles.pillAnimation} style={{ animationDelay: '1.0s' }} />
          </g>

          {/* House Outline Stroke - Drawn on top of pills for depth */}
          <path
            d="M100 30 L40 90 M100 30 L160 90 M60 90 V170 H140 V90"
            stroke="var(--text-secondary)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {demo && !hideLabel && (
        <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
          התרופה לבלאגן בחשבונות שלך
        </div>
      )}
    </div>
  );
};
