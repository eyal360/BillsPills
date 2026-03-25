import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { PillIcon } from '../components/PillIcon';
import { Sun, Moon } from 'lucide-react';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, showChatBubble, toggleChatBubble } = useSettings();
  const { logout } = useAuth();
  const { confirm } = useDialog();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'התנתקות מהמערכת',
      message: 'האם אתה בטוח שברצונך להתנתק? נתגעגע!',
      icon: '👋',
      actions: [
        { label: 'התנתק', type: 'danger' },
        { label: 'ביטול', type: 'ghost' }
      ]
    });

    if (confirmed === 0) {
      logout();
      navigate('/login');
    }
  };

  return (
    <Layout showBack={false} title="הגדרות">
      <div className="page-content">
        <div className="settings-section card">
          {/* ערכת נושא */}
          <div className="settings-row luxury-row">
            <div className="settings-label">ערכת נושא</div>
            <div className="theme-toggle-container">
              <button
                onClick={() => setTheme('light')}
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
              >
                <Sun size={18} strokeWidth={2.5} />
                <span>בהיר</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
              >
                <Moon size={18} strokeWidth={2.5} />
                <span>כהה</span>
              </button>
            </div>
          </div>

          <div className="dropdown-divider" style={{ margin: '12px 0', opacity: 0.1 }}></div>

          {/* הצג בועת צ'אט */}
          <div className="settings-row luxury-row">
            <div className="settings-label">
              <span>הצג בועת צ'אט</span>
              <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>💬</span>
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
