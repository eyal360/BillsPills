import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { PillIcon } from '../components/PillIcon';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, showChatBubble, toggleChatBubble } = useSettings();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('האם אתה בטוח שברצונך להתנתק?')) {
      logout();
      navigate('/login');
    }
  };

  return (
    <Layout title="הגדרות">
      <div className="page-content">
        <div className="settings-section card">
          <h3 className="settings-section-title">מראה</h3>

          <div className="settings-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
            <div className="settings-row-info" style={{ width: '100%' }}>
              <div>
                <div className="font-semibold">מצב תצוגה</div>
                <div className="text-sm text-muted">בחר ערכת נושא רצויה</div>
              </div>
            </div>
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', padding: '6px', width: '100%', gap: '4px' }}>
              <button 
                onClick={() => setTheme('light')}
                style={{ flex: 1, padding: '10px 0', border: 'none', background: theme === 'light' ? 'var(--brand-primary)' : 'transparent', color: theme === 'light' ? '#fff' : 'var(--text-secondary)', borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '1.2rem' }}
                aria-label="מצב בהיר"
              >
                ☀️
              </button>
              <button 
                onClick={() => setTheme('system')}
                style={{ flex: 2, padding: '10px 0', border: 'none', background: theme === 'system' ? 'var(--brand-primary)' : 'transparent', color: theme === 'system' ? '#fff' : 'var(--text-secondary)', borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, fontSize: '0.9rem' }}
                aria-label="ברירת מחדל"
              >
                אוטומטי
              </button>
              <button 
                onClick={() => setTheme('dark')}
                style={{ flex: 1, padding: '10px 0', border: 'none', background: theme === 'dark' ? 'var(--brand-primary)' : 'transparent', color: theme === 'dark' ? '#fff' : 'var(--text-secondary)', borderRadius: 'var(--radius-full)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '1.2rem' }}
                aria-label="מצב כהה"
              >
                🌙
              </button>
            </div>
          </div>
        </div>

        <div className="settings-section card">
          <h3 className="settings-section-title">בינה מלאכותית</h3>

          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-icon">💬</div>
              <div>
                <div className="font-semibold">בועת צ'אט AI</div>
                <div className="text-sm text-muted">
                  {showChatBubble ? 'מוצגת בכל הדפים' : 'מוסתרת'}
                </div>
              </div>
            </div>
            <button
              className={`toggle ${showChatBubble ? 'toggle-on' : ''}`}
              onClick={toggleChatBubble}
              aria-label="הצג/הסתר בועת צ'אט"
            />
          </div>
        </div>

        <div className="settings-section card">
          <h3 className="settings-section-title">אודות</h3>
          <div className="about-content text-center">
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <PillIcon size={64} style={{ margin: '0 auto' }} />
            </div>
            <div className="brand-text" style={{ fontSize: '1.5rem', fontWeight: 900 }}>BillsPills</div>
            <div className="text-sm text-muted mt-sm">גרסה 1.0.0</div>
            <div className="text-sm text-muted">ניהול חכם של חשבונות ונכסים</div>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="btn btn-secondary btn-full" 
          style={{ marginTop: 'var(--space-lg)', color: '#ef4444', borderColor: '#ef4444', background: 'transparent' }}
        >
          התנתק מהמערכת
        </button>
      </div>
    </Layout>
  );
};
