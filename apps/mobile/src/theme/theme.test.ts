import { contrastRatio, WCAG_AA_TEXT } from './contrast';
import { darkPalette, lightPalette, motionDuration, type Palette } from './tokens';

const pairs = (p: Palette): [string, string, string][] => [
  ['text on background', p.text, p.background],
  ['text on surface', p.text, p.surface],
  ['muted text on background', p.textMuted, p.background],
  ['muted text on surface', p.textMuted, p.surface],
  ['accent on background', p.accent, p.background],
  ['accent on surface', p.accent, p.surface],
  ['text on accent fill', p.onAccent, p.accent],
  ['danger on background', p.danger, p.background],
  ['success on background', p.success, p.background],
  ['warning on background', p.warning, p.background],
];

describe('WCAG AA contrast', () => {
  for (const [mode, palette] of [['light', lightPalette], ['dark', darkPalette]] as const) {
    for (const [name, fg, bg] of pairs(palette)) {
      it(`${mode}: ${name} is at least 4.5:1`, () => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      });
    }
  }
  it('uses the locked brand tokens', () => {
    expect(lightPalette.background).toBe('#FAF7F0');
    expect(lightPalette.text).toBe('#1F1F1D');
    expect(lightPalette.accent).toBe('#5E6B4A');
    expect(darkPalette.background).toBe('#141412');
  });
  it('reduce motion collapses durations', () => {
    expect(motionDuration(200, true)).toBe(0);
    expect(motionDuration(200, false)).toBe(200);
  });
});
