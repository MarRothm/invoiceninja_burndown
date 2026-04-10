import { useState, useEffect } from 'react';
import { themes, defaultTheme } from '../themes.js';

export function useTheme() {
  const [themeKey, setThemeKey] = useState(() => {
    return localStorage.getItem('theme') || defaultTheme;
  });

  useEffect(() => {
    const theme = themes[themeKey] ?? themes[defaultTheme];
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    localStorage.setItem('theme', themeKey);
  }, [themeKey]);

  const theme = themes[themeKey] ?? themes[defaultTheme];

  return { themeKey, setThemeKey, theme };
}
