import { contrastRatio, WCAG_AA_TEXT } from './contrast';
import { brand, darkPalette, lightPalette, motionDuration, type Palette } from './tokens';

const UI_GRAPHIC = 3;

/** Every pair the UI actually draws: [description, foreground, background, minimum ratio]. */
const pairs = (p: Palette): [string, string, string, number][] => [
  ['text on background', p.text, p.background, WCAG_AA_TEXT],
  ['text on surface', p.text, p.surface, WCAG_AA_TEXT],
  ['text on surfaceAlt', p.text, p.surfaceAlt, WCAG_AA_TEXT],
  ['muted text on background', p.textMuted, p.background, WCAG_AA_TEXT],
  ['muted text on surface', p.textMuted, p.surface, WCAG_AA_TEXT],
  ['muted text on surfaceAlt', p.textMuted, p.surfaceAlt, WCAG_AA_TEXT],
  ['accent text on background', p.accentText, p.background, WCAG_AA_TEXT],
  ['accent text on surface', p.accentText, p.surface, WCAG_AA_TEXT],
  ['accent text on surfaceAlt', p.accentText, p.surfaceAlt, WCAG_AA_TEXT],
  ['label on accent fill', p.onAccent, p.accent, WCAG_AA_TEXT],
  ['label on highlight fill', p.onHighlight, p.highlight, WCAG_AA_TEXT],
  ['danger on background', p.danger, p.background, WCAG_AA_TEXT],
  ['danger on surface', p.danger, p.surface, WCAG_AA_TEXT],
  ['success on background', p.success, p.background, WCAG_AA_TEXT],
  ['success on surface', p.success, p.surface, WCAG_AA_TEXT],
  ['warning on background', p.warning, p.background, WCAG_AA_TEXT],
  ['warning on surface', p.warning, p.surface, WCAG_AA_TEXT],
  ['control border on background', p.borderStrong, p.background, UI_GRAPHIC],
  ['control border on surface', p.borderStrong, p.surface, UI_GRAPHIC],
  ['accent icons on background', p.accentText, p.background, UI_GRAPHIC],
];

describe('WCAG AA contrast for every colour role', () => {
  for (const [mode, palette] of [['light', lightPalette], ['dark', darkPalette]] as const) {
    for (const [name, fg, bg, min] of pairs(palette)) {
      it(`${mode}: ${name} is at least ${min}:1`, () => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe('brand palette', () => {
  it('uses the approved brand colours', () => {
    expect(brand).toEqual({ ivory: '#F7F4EC', sage: '#87977A', olive: '#B1B99A', gold: '#D8B875', charcoal: '#292B26', warmGrey: '#77766F' });
  });
  it('light mode is the default and uses ivory and charcoal', () => {
    expect(lightPalette.background).toBe(brand.ivory);
    expect(lightPalette.text).toBe(brand.charcoal);
    expect(lightPalette.accent).toBe(brand.sage);
    expect(lightPalette.highlight).toBe(brand.gold);
  });
  it('dark mode keeps the brand accents on a warm near black', () => {
    expect(darkPalette.accent).toBe(brand.sage);
    expect(darkPalette.text).toBe(brand.ivory);
    expect(darkPalette.surface).toBe(brand.charcoal);
  });
  it('documents why raw brand colours are not used as text', () => {
    // These raw pairs fail AA, which is why accentText, onAccent and onHighlight exist.
    expect(contrastRatio(brand.sage, brand.ivory)).toBeLessThan(WCAG_AA_TEXT);
    expect(contrastRatio(brand.gold, brand.ivory)).toBeLessThan(WCAG_AA_TEXT);
    expect(contrastRatio(brand.warmGrey, brand.ivory)).toBeLessThan(WCAG_AA_TEXT);
  });
  it('reduce motion collapses durations', () => {
    expect(motionDuration(200, true)).toBe(0);
    expect(motionDuration(200, false)).toBe(200);
  });
});
