import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface SettingsContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  showChatBubble: boolean;
  toggleChatBubble: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme;
    if (saved === 'light' || saved === 'dark') return saved;
    // Default to system preference on first load
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [showChatBubble, setShowChatBubble] = useState(() => {
    return localStorage.getItem('showChatBubble') !== 'false';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
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
