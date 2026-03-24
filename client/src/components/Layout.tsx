import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PillIcon } from './PillIcon';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  headerActions?: React.ReactNode;
  titleClassName?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack, headerActions, titleClassName }) => {
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'בוקר טוב';
    if (hour >= 12 && hour < 18) return 'צהריים טובים';
    if (hour >= 18 && hour < 22) return 'ערב טוב';
    return 'לילה טוב';
  };

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';

  const handleUserClick = () => {
    if (location.pathname === '/settings') {
      navigate('/');
    } else {
      navigate('/settings');
    }
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
          left: 0,
          right: 0,
          top: 0,
          zIndex: 100,
          pointerEvents: 'none' // Allow scrolling underlying content when clicking empty parts of header
        }}
      >
        {/* Visual Right Side (RTL Start) - Greeting & User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {/* Settings Icon (Start of RTL) */}
          <button 
            onClick={handleUserClick}
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
              fontSize: '1.2rem',
              cursor: 'pointer',
              pointerEvents: 'auto',
              flexShrink: 0
            }}
            title="הגדרות"
          >
            ⚙️
          </button>

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
                pointerEvents: 'auto',
                flexShrink: 0
              }}
              title="חזור"
            >
              ←
            </button>
          )}

          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              pointerEvents: 'auto',
              color: 'var(--text-primary)',
              minWidth: 0
            }}
          >
            <span 
              className="drop-shadow-text truncate" 
              style={{ 
                fontSize: '0.9rem', 
                fontWeight: 600,
                maxWidth: '50vw'
              }}
            >
              {getGreeting()}, {firstName}
            </span>
          </div>
        </div>

        {/* Visual Left Side (RTL End) - Logo */}
        <div 
          onClick={handlePillClick}
          style={{ 
            cursor: 'pointer',
            pointerEvents: 'auto',
            padding: '0 16px'
          }}
        >
          <PillIcon size={40} style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.3))' }} />
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
        {title && (
          <div className="title-row-container" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginBottom: 'var(--space-xs)',
            position: 'relative'
          }}>
            <div style={{ flex: 1 }}></div>
            <div className="title-with-actions" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              justifyContent: 'center'
            }}>
              <h1 className={`page-title text-center ${titleClassName || ''}`} style={{ margin: 0 }}>{title}</h1>
              {headerActions && (
                <div className="header-actions" style={{ display: 'flex', alignItems: 'center' }}>
                  {headerActions}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}></div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
};
