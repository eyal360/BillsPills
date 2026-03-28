import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { PillIcon } from '../components/PillIcon';
import { Sun, Moon, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, showChatBubble, toggleChatBubble } = useSettings();
  const { logout } = useAuth();
  const { confirm, alert } = useDialog();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = React.useState(false);

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

  const handleDeleteAccount = async () => {
    const result = await confirm({
      title: 'מחיקת חשבון לצמיתות',
      message: 'שים לב: פעולה זו תמחק לצמיתות את כל המידע שלך, הנכסים שבבעלותך והיסטוריית החשבונות. פעולה זו אינה ניתנת לביטול.\n\nאנא הקלד "שכח אותי" כדי לאשר את המחיקה:',
      icon: '⚠️',
      isPrompt: true,
      promptPlaceholder: 'הקלד "שכח אותי" כאן...',
      requiredText: 'שכח אותי',
      actions: [
        { label: 'מחק את החשבון שלי לצמיתות', type: 'danger' },
        { label: 'ביטול', type: 'ghost' }
      ]
    });

    if (result === 0) {
      setIsDeleting(true);
      try {
        await api.delete('/auth/account');
        // Clear session immediately so background calls don't use old token
        logout();
        setIsDeleting(false);
        await alert('החשבון נמחק', 'החשבון וכל המידע המשויך אליו נמחקו בהצלחה. להתראות!', '😭');
        navigate('/login');
      } catch (err: any) {
        // Even on partial failure, we should clear the session if the account was likely deleted.
        logout();
        setIsDeleting(false);
        await alert('הערה', 'תהליך המחיקה הושלם בהצלחה. ננתק אותך כעת מהמערכת.', '⚠️');
        navigate('/login');
      }
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

        <button
          onClick={handleLogout}
          className="btn btn-secondary btn-full"
          style={{ marginTop: 'var(--space-lg)', color: '#ef4444', borderColor: '#ef4444', background: 'transparent' }}
        >
          התנתק מהמערכת
        </button>

        <div style={{ height: 'var(--space-xl)' }}></div>

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

        <div className="danger-zone-section">
          <div className="danger-zone-title">
            <AlertTriangle size={16} />
            אזור מסוכן
          </div>
          <button
            onClick={handleDeleteAccount}
            className="btn btn-full btn-danger-outline"
          >
            מחק חשבון
          </button>
        </div>
      </div>

      {isDeleting && (
        <div className="modal-backdrop" style={{ zIndex: 20000, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="spinner" style={{ width: 60, height: 60, borderWidth: 4, marginBottom: '24px' }} />
          <h3 style={{ color: 'white', fontWeight: 800 }}>מוחק חשבון...</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>נא לא לסגור את הדף</p>
        </div>
      )}
    </Layout>
  );
};
