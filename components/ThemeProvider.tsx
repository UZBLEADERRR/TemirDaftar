import React, { createContext, useContext, useEffect, useState } from 'react';
import { getTelegramWebApp } from '@/src/lib/telegram';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{ theme: Theme }>({ theme: 'dark' });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      const colorScheme = tg.colorScheme || 'dark';
      setTheme(colorScheme);
      document.documentElement.classList.toggle('dark', colorScheme === 'dark');
    } else {
      // Fallback: check system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(isDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
