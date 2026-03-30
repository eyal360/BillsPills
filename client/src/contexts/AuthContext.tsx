import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import api from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    let mounted = true;

    const handleSession = (access_token: string) => {
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('lastActiveTime', Date.now().toString()); // Reset 30-day idle timer

      api.get('/auth/me')
        .then(res => {
          if (mounted) setUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('access_token');
          if (mounted) setUser(null);
        })
        .finally(() => {
          if (mounted) setIsLoading(false);
        });
    };

    import('../lib/supabase').then(({ supabase }) => {
      // First check for session explicitly
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          // 30-day inactivity check (per-device).
          // Only enforced when this device has a stored lastActiveTime.
          // New devices (no stored value) are always allowed in immediately.
          const lastActive = localStorage.getItem('lastActiveTime');
          if (lastActive) {
            const msSinceActive = Date.now() - parseInt(lastActive);
            if (msSinceActive > THIRTY_DAYS_MS) {
              // This device has been idle 30+ days — force re-login
              supabase.auth.signOut();
              localStorage.removeItem('access_token');
              localStorage.removeItem('lastActiveTime');
              if (mounted) { setIsLoading(false); setUser(null); }
              return;
            }
          }
          handleSession(session.access_token);

        } else {
          const hash = window.location.hash;
          const search = window.location.search;

          // If Supabase returned an error (e.g. provider misconfiguration), show login immediately
          const isOAuthError = hash.includes('error=') || search.includes('error=');
          if (isOAuthError) {
            if (mounted) { setIsLoading(false); setUser(null); }
            return;
          }

          // Supabase implicit flow: #access_token= in hash
          // Supabase PKCE flow: ?code= in query string
          const isOAuthCallback = hash.includes('access_token') || search.includes('code=');
          if (isOAuthCallback) {
            // Stay loading — onAuthStateChange will fire once the code is exchanged.
            // Safety fallback if exchange never completes:
            setTimeout(() => {
              if (mounted) { setIsLoading(false); setUser(null); }
            }, 8000);
            return;
          }

          if (mounted) { setIsLoading(false); setUser(null); }
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          handleSession(session.access_token);

          // When returning from the Drive-specific OAuth, the session has provider_token.
          // Use raw fetch (not the api axios instance) to avoid the 401 interceptor.
          if (event === 'SIGNED_IN' && session.provider_token) {
            const token = session.access_token;
            fetch('/api/auth/google-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                provider_token: session.provider_token,
                provider_refresh_token: session.provider_refresh_token ?? null,
              }),
            }).catch(() => {/* silent */});
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
            localStorage.removeItem('access_token');
          }
        }
      });

      return () => subscription.unsubscribe();
    });

    return () => { mounted = false; };
  }, []);

  const logout = () => {
    // Attempt backend logout, but also clean up locally and in supabase client
    api.post('/auth/logout').catch(() => { });
    import('../lib/supabase').then(({ supabase }) => supabase.auth.signOut());
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
