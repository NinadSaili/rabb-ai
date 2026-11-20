/**
 * Design tokens. Brand palette (updated design direction): warm ivory, sage green, muted olive, soft gold,
 * deep charcoal, warm grey. Brand colours are assigned ROLES so that every text and icon pair passes WCAG AA:
 *  - sage is a fill (buttons, rings), never text on ivory. Text and icons use accentText, a deeper sage.
 *  - gold is a fill (badges, highlights), never text.
 *  - olive tints surfaces and chips.
 * Contrast is enforced by src/theme/theme.test.ts for every role pair in both modes.
 */
export const brand = {
  ivory: '#F7F4EC',
  sage: '#87977A',
  olive: '#B1B99A',
  gold: '#D8B875',
  charcoal: '#292B26',
  warmGrey: '#77766F',
} as const;

export interface Palette {
  background: string;
  surface: string;
  /** Subtle olive tinted surface for chips, rows and inactive areas. */
  surfaceAlt: string;
  text: string;
  textMuted: string;
  /** Fill for primary actions and progress. Not for text on the background. */
  accent: string;
  /** Label colour on top of the accent fill. */
  onAccent: string;
  /** Deeper sage for accent text, icons and outlines on background and surface. */
  accentText: string;
  /** Soft gold fill for milestones and celebrations. */
  highlight: string;
  onHighlight: string;
  /** Dividers and decorative borders. */
  border: string;
  /** Borders of inputs and other controls (3:1 against the background). */
  borderStrong: string;
  danger: string;
  success: string;
  warning: string;
}

export const lightPalette: Palette = {
  background: brand.ivory,
  surface: '#FFFFFF',
  surfaceAlt: '#ECEEE0',
  text: brand.charcoal,
  textMuted: '#66655E',
  accent: brand.sage,
  onAccent: brand.charcoal,
  accentText: '#4F5E43',
  highlight: brand.gold,
  onHighlight: brand.charcoal,
  border: '#DAD6C8',
  borderStrong: '#8B887B',
  danger: '#9B3B33',
  success: '#4F6B3A',
  warning: '#8A5A00',
};

export const darkPalette: Palette = {
  background: '#1F201C',
  surface: brand.charcoal,
  surfaceAlt: '#33362F',
  text: brand.ivory,
  textMuted: '#B1B0A7',
  accent: brand.sage,
  onAccent: '#1F201C',
  accentText: '#9BAA8D',
  highlight: brand.gold,
  onHighlight: '#1F201C',
  border: '#3F4239',
  borderStrong: '#7A7D70',
  danger: '#F0A59B',
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

/** 4pt grid. Generous spacing is part of the visual direction. */
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Scripture default 20pt. Font scale up to 200 percent is allowed (no maxFontSizeMultiplier below 2). */
export const typography = {
  scriptureSize: 20,
  scriptureLineHeight: 32,
  bodySize: 16,
  bodyLineHeight: 24,
  captionSize: 13,
  titleSize: 28,
  headlineSize: 22,
  displaySize: 44,
  maxFontSizeMultiplier: 2.5,
} as const;

/** Subtle elevation for cards. */
export const elevation = {
  card: { shadowColor: '#292B26', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  none: { shadowOpacity: 0, elevation: 0 },
} as const;

/** Minimal motion. Durations collapse to 0 when the user prefers reduced motion. */
export const motion = { fast: 120, normal: 200 } as const;
export function motionDuration(ms: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : ms;
}
