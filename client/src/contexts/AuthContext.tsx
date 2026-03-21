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

  useEffect(() => {
    let mounted = true;

    const handleSession = (access_token: string) => {
      localStorage.setItem('access_token', access_token);
      api.get('/auth/me')
        .then(res => { if (mounted) setUser(res.data); })
        .catch(() => {
          localStorage.removeItem('access_token');
          if (mounted) setUser(null);
        })
        .finally(() => { if (mounted) setIsLoading(false); });
    };

    import('../lib/supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          handleSession(session.access_token);
        } else {
          if (mounted) setIsLoading(false);
          if (mounted) setUser(null);
        }
      });

      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          handleSession(session.access_token);
        } else {
          if (mounted) setUser(null);
          localStorage.removeItem('access_token');
        }
      });
    });

    return () => { mounted = false; };
  }, []);

  const logout = () => {
    // Attempt backend logout, but also clean up locally and in supabase client
    api.post('/auth/logout').catch(() => {});
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
