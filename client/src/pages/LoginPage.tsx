import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PillIcon } from '../components/PillIcon';
import { APP_MESSAGES } from '../lib/constants';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <PillIcon size={180} />
          </div>
          <h1 className="brand-text">BillsPills</h1>
          <p className="login-subtitle">התרופה לבלאגן בחשבונות שלך</p>
        </div>

        {/* Action Area */}
        <div className="login-action-area" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', padding: '0 20px' }}>
          {error && (
            <div className="error-alert">
              ⚠️ {error}
            </div>
          )}

          <button
            className="btn btn-secondary btn-full btn-lg"
            style={{ marginTop: 'var(--space-md)', background: '#fff', color: '#333', borderColor: '#ddd' }}
            onClick={async () => {
              setLoading(true);
              try {
                const { supabase } = await import('../lib/supabase');
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: window.location.origin,
                    scopes: 'https://www.googleapis.com/auth/drive.file',
                    queryParams: {
                      access_type: 'offline',
                      // No prompt: 'consent' — Google shows Drive consent once on first login,
                      // then auto-signs in returning users (0 screens). Refresh token is
                      // stored permanently in DB so Drive works indefinitely.
                    },
                  }
                });
              } catch (err: unknown) {
                // error expected handling below
                setError(APP_MESSAGES.GENERIC_ERROR);
                setLoading(false);
              }
            }}
            disabled={loading}
            type="button"
          >
            {loading ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {/* Google Logo */}
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                כניסה מהירה עם גוגל
              </span>
            )}
          </button>
        </div>

        <p className="login-footer text-xs text-muted text-center">
          מאובטח ומוצפן • BillsPills © 2025
        </p>
      </div>
    </div>
  );
};
