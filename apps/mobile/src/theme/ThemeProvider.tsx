import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './tokens';

export interface Theme {
  palette: Palette;
  mode: 'light' | 'dark';
  reduceMotion: boolean;
  /** Extra multiplier from the in-app reading size setting. System font scale applies on top. */
  readingScale: number;
}

const ThemeContext = createContext<Theme>({ palette: lightPalette, mode: 'light', reduceMotion: false, readingScale: 1 });

export function ThemeProvider({ children, readingScale = 1 }: { children: React.ReactNode; readingScale?: number }) {
  const scheme = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  const value = useMemo<Theme>(() => {
    const mode = scheme === 'dark' ? 'dark' : 'light';
    return { palette: mode === 'dark' ? darkPalette : lightPalette, mode, reduceMotion, readingScale };
  }, [scheme, reduceMotion, readingScale]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
