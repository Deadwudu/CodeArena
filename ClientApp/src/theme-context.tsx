import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {applyTheme, loadTheme, saveTheme, type ThemeMode} from './storage';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [theme, setThemeState] = useState<ThemeMode>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    saveTheme(mode);
    applyTheme(mode);
  }, []);

  return <ThemeContext.Provider value={{theme, setTheme}}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme: оберните приложение в ThemeProvider');
  return ctx;
}

export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
