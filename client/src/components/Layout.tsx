import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PillIcon } from './PillIcon';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Pull to refresh states
  const [startY, setStartY] = useState(0);
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) setStartY(e.touches[0].clientY);
      else setStartY(0);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startY) return;
      const currentY = e.touches[0].clientY;
      const dist = currentY - startY;

      if (dist > 0 && window.scrollY <= 0) {
        if (e.cancelable) e.preventDefault();
        setPullDist(Math.min(dist * 0.4, 80));
      }
    };

    const handleTouchEnd = () => {
      if (pullDist > 60) {
        setRefreshing(true);
        window.location.reload();
      } else {
        setPullDist(0);
        setStartY(0);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, pullDist]);

  const handlePillClick = () => {
    if (location.pathname === '/') {
      window.location.reload();
    } else {
      navigate('/');
    }
  };

  const handleUserClick = () => {
    navigate('/settings');
  };

  return (
    <div className="layout">
      {/* Pull to refresh visual indicator */}
      <div 
        style={{ 
          height: `${pullDist}px`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflow: 'hidden',
          transition: refreshing ? 'height 0.3s' : (pullDist === 0 ? 'height 0.3s' : 'none'),
          backgroundColor: 'transparent'
        }}
      >
        <div style={{ 
          transform: `rotate(${pullDist * 3}deg)`, 
          opacity: pullDist / 60,
          fontSize: '1.2rem',
          color: 'var(--brand-primary)'
        }}>
          {refreshing ? '⏳' : '🔄'}
        </div>
      </div>

      {/* Transparent Header */}
      <header 
        className="page-header fade-header" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '0 var(--space-md)',
          background: 'transparent',
          borderBottom: 'none',
          position: 'fixed',
          width: '100%',
          top: 0,
          zIndex: 100,
          pointerEvents: 'none' // Allow scrolling underlying content when clicking empty parts of header
        }}
      >
        {/* Visual Right Side (RTL Start) - User Profile or Back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {showBack && (
            <button 
              onClick={() => navigate(-1)}
              style={{ 
                background: 'rgba(255,255,255,0.05)', 
                border: 'none', 
                borderRadius: 'var(--radius-full)', 
                width: '36px', 
                height: '36px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--brand-primary)',
                fontSize: '1.4rem',
                cursor: 'pointer',
                pointerEvents: 'auto'
              }}
              title="חזור"
            >
              ←
            </button>
          )}
          <div 
            onClick={handleUserClick}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            <div className="user-avatar" style={{ width: 36, height: 36, fontSize: '1rem' }}>
              {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
            </div>
            {user?.full_name && (
              <span className="font-semibold text-sm drop-shadow-text">{user.full_name.split(' ')[0]}</span>
            )}
          </div>
        </div>

        {/* Visual Left Side (RTL End) - Logo */}
        <div 
          onClick={handlePillClick}
          style={{ 
            cursor: 'pointer',
            pointerEvents: 'auto',
            padding: '8px'
          }}
        >
          <PillIcon size={32} style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }} />
        </div>
      </header>

      {/* Main Content with mask fade for header overlap */}
      <main 
        className="layout-main fade-content" 
        style={{ 
          paddingTop: '70px', /* space for fixed header */
          minHeight: '100dvh'
        }}
      >
        {title && <h1 className="page-title text-center mb-xs">{title}</h1>}
        {children}
      </main>
    </div>
  );
};
