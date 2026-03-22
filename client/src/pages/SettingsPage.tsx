import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { PillIcon } from '../components/PillIcon';
import { Sun, Moon } from 'lucide-react';
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
    <Layout showBack={false} title="הגדרות">
      <div className="page-content">
        <div className="settings-section card">
          <h3 className="settings-section-title">מראה</h3>

          <div className="settings-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
            <div className="settings-row-info" style={{ width: '100%' }}>
              <div>
                <div className="font-semibold">ערכת נושא</div>
              </div>
            </div>
            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', padding: '6px', width: '100%', gap: '4px' }}>
              <button
                onClick={() => setTheme('light')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  background: theme === 'light' ? 'var(--brand-primary)' : 'transparent',
                  color: theme === 'light' ? '#fff' : 'var(--text-secondary)',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>בהיר</span>
                <Sun size={24} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setTheme('dark')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  background: theme === 'dark' ? 'var(--brand-primary)' : 'transparent',
                  color: theme === 'dark' ? '#fff' : 'var(--text-secondary)',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>כהה</span>
                <Moon size={24} strokeWidth={2.5} />
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
                <div className="font-semibold">הצג בועת צ'אט</div>
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
          <div className="about-content text-center">
            <div className="mt-sm" style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>
              <p>האפליקציה פותחה מאהבה ורצון לעזור לאנשים לנהל את החיים שלהם בקלות.</p>
              <p className="mt-md" style={{ fontSize: '0.9rem' }}>עזרו לי לממן עוד אפליקציות שיסייעו לקהילה</p>
            </div>

            <div className="mt-lg flex justify-center">
              <a
                href="https://www.buymeacoffee.com/eyalhuri7e"
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{
                  background: '#5F7FFF',
                  color: '#ffffff',
                  padding: '14px 28px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: '0 8px 25px rgba(95, 127, 255, 0.4)',
                  fontSize: '1.1rem',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'transform 0.2s',
                  textDecoration: 'none'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ fontFamily: '"Comic Sans MS", cursive, sans-serif', fontWeight: 800 }}>Help me Fund some BillsPills</span>
                <PillIcon size={40} />
              </a>
            </div>
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
