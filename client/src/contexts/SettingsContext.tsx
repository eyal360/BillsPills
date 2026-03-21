import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface SettingsContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  showChatBubble: boolean;
  toggleChatBubble: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'system';
  });
  
  const [showChatBubble, setShowChatBubble] = useState(() => {
    return localStorage.getItem('showChatBubble') !== 'false';
  });

  useEffect(() => {
    const applyTheme = (t: Theme) => {
      let activeTheme = t;
      if (t === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', activeTheme);
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') applyTheme('system');
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const toggleChatBubble = () => {
    setShowChatBubble(v => {
      localStorage.setItem('showChatBubble', String(!v));
      return !v;
    });
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, showChatBubble, toggleChatBubble }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
