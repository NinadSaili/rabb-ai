/** Design tokens. Values for cream, charcoal, olive and the dark mode base come from AGENTS.md. */
export interface Palette {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  /** Text on top of the accent fill. */
  onAccent: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
}

export const lightPalette: Palette = {
  background: '#FAF7F0',
  surface: '#FFFFFF',
  text: '#1F1F1D',
  textMuted: '#55554F',
  accent: '#5E6B4A',
  onAccent: '#FFFFFF',
  border: '#D9D4C7',
  danger: '#9B2C2C',
  success: '#3F5B2E',
  warning: '#8A5A00',
};

export const darkPalette: Palette = {
  background: '#141412',
  surface: '#1E1E1B',
  text: '#F2EEE4',
  textMuted: '#B9B5A8',
  accent: '#A9B88F',
  onAccent: '#141412',
  border: '#3A3A35',
  danger: '#F2A0A0',
  success: '#A8C98E',
  warning: '#E8C06A',
};

export const fonts = {
  scripture: 'Newsreader_400Regular',
  scriptureItalic: 'Newsreader_400Regular_Italic',
  scriptureStrong: 'Newsreader_600SemiBold',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemibold: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20 } as const;

/** Scripture default 20pt. Font scale up to 200 percent is allowed (no maxFontSizeMultiplier below 2). */
export const typography = {
  scriptureSize: 20,
  scriptureLineHeight: 32,
  bodySize: 16,
  bodyLineHeight: 24,
  captionSize: 13,
  titleSize: 24,
  maxFontSizeMultiplier: 2.5,
} as const;

/** Minimal motion. Durations collapse to 0 when the user prefers reduced motion. */
export const motion = { fast: 120, normal: 200 } as const;
export function motionDuration(ms: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : ms;
}
