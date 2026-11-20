import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { elevation, fonts, radius, spacing, typography } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

const MAX = typography.maxFontSizeMultiplier;

export type IconName = 'home' | 'book' | 'prayer' | 'journey' | 'profile' | 'check' | 'flame' | 'lock' | 'chevron' | 'star';

/** Simple stroke icons (24x24 grid). Decorative: the surrounding control carries the accessible name. */
const PATHS: Record<IconName, string> = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  book: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z',
  prayer: 'M12 3v4M8 6l2 3M16 6l-2 3M7 21v-6c0-2 2-3 5-3s5 1 5 3v6',
  journey: 'M4 19c4 0 3-7 8-7s4-7 8-7M4 19h.01M20 5h.01',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6',
  check: 'M5 12.5 10 17.5 19 7',
  flame: 'M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6z',
  chevron: 'M9 5l7 7-7 7',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
};

export function Icon({ name, size = 24, color, strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const { palette } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={PATHS[name]} stroke={color ?? palette.accentText} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Daily progress ring. `progress` is 0..1. Draws sage on a surfaceAlt track; the label carries the meaning. */
export function ProgressRing({ progress, size = 120, strokeWidth = 12, label, children }: { progress: number; size?: number; strokeWidth?: number; label: string; children?: React.ReactNode }) {
  const { palette } = useTheme();
  const p = Math.min(1, Math.max(0, progress));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.surfaceAlt} strokeWidth={strokeWidth} fill="none" />
        {p > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={p >= 1 ? palette.highlight : palette.accent} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/** Streak summary. Copy is encouraging and never shames a missed day. */
export function StreakCard({ title, subtitle, bestLabel }: { title: string; subtitle: string; bestLabel?: string }) {
  const { palette } = useTheme();
  return (
    <View accessible accessibilityLabel={`${title}. ${subtitle}${bestLabel ? `. ${bestLabel}` : ''}`} style={[styles.card, elevation.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[styles.flame, { backgroundColor: palette.highlight }]}><Icon name="flame" color={palette.onHighlight} /></View>
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={MAX} style={{ color: palette.text, fontFamily: fonts.uiBold, fontSize: typography.headlineSize }}>{title}</Text>
        <Text maxFontSizeMultiplier={MAX} style={{ color: palette.textMuted, fontFamily: fonts.ui, fontSize: typography.captionSize + 1 }}>{subtitle}</Text>
      </View>
      {bestLabel ? <Text maxFontSizeMultiplier={MAX} style={{ color: palette.textMuted, fontFamily: fonts.uiMedium, fontSize: typography.captionSize }}>{bestLabel}</Text> : null}
    </View>
  );
}

export type WeekDay = { key: string; label: string; state: 'done' | 'today' | 'upcoming' | 'missed' };

/** Seven day strip. A missed day is a neutral outline, never a red mark. */
export function WeekStrip({ days, a11yLabel }: { days: WeekDay[]; a11yLabel: string }) {
  const { palette } = useTheme();
  return (
    <View accessible accessibilityLabel={a11yLabel} style={styles.week}>
      {days.map((d) => (
        <View key={d.key} style={styles.weekItem}>
          <View style={[styles.weekDot, d.state === 'done' ? { backgroundColor: palette.accent, borderColor: palette.accentText } : { backgroundColor: 'transparent', borderColor: d.state === 'today' ? palette.accentText : palette.borderStrong, borderStyle: d.state === 'missed' ? 'dashed' : 'solid' }]}>
            {d.state === 'done' ? <Icon name="check" size={16} color={palette.onAccent} strokeWidth={2.4} /> : null}
          </View>
          <Text maxFontSizeMultiplier={MAX} style={{ color: d.state === 'today' ? palette.text : palette.textMuted, fontFamily: d.state === 'today' ? fonts.uiSemibold : fonts.ui, fontSize: typography.captionSize }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Milestone badge. Earned badges use the soft gold fill; locked ones show an outline and the criterion. */
export function MilestoneBadge({ title, description, earned }: { title: string; description: string; earned: boolean }) {
  const { palette } = useTheme();
  return (
    <View accessible accessibilityLabel={`${title}. ${description}. ${earned ? 'Earned' : 'Not yet earned'}`} style={[styles.badge, { backgroundColor: earned ? palette.highlight : palette.surfaceAlt, borderColor: earned ? palette.highlight : palette.borderStrong }]}>
      <Icon name={earned ? 'star' : 'lock'} size={22} color={earned ? palette.onHighlight : palette.textMuted} />
      <Text maxFontSizeMultiplier={MAX} style={{ color: earned ? palette.onHighlight : palette.text, fontFamily: fonts.uiSemibold, fontSize: typography.captionSize + 1, textAlign: 'center' }}>{title}</Text>
      <Text maxFontSizeMultiplier={MAX} style={{ color: earned ? palette.onHighlight : palette.textMuted, fontFamily: fonts.ui, fontSize: typography.captionSize, textAlign: 'center' }}>{description}</Text>
    </View>
  );
}

/** Tappable list row with a title, optional subtitle and trailing chevron. 56pt minimum height. */
export function ListRow({ title, subtitle, onPress, trailing, testID }: { title: string; subtitle?: string; onPress?: () => void; trailing?: React.ReactNode; testID?: string }) {
  const { palette } = useTheme();
  const content = (
    <>
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={MAX} style={{ color: palette.text, fontFamily: fonts.uiMedium, fontSize: typography.bodySize }}>{title}</Text>
        {subtitle ? <Text maxFontSizeMultiplier={MAX} style={{ color: palette.textMuted, fontFamily: fonts.ui, fontSize: typography.captionSize + 1 }}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron" size={18} color={palette.textMuted} /> : null)}
    </>
  );
  const style = [styles.listRow, { borderColor: palette.border }];
  return onPress ? (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title} onPress={onPress} style={({ pressed }) => [...style, { opacity: pressed ? 0.8 : 1 }]}>{content}</Pressable>
  ) : (
    <View testID={testID} style={style}>{content}</View>
  );
}

/** Selectable chip (filters, schedule days). Selected state is conveyed by fill, border weight and a11y state. */
export function Chip({ label, selected, onPress, testID }: { label: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  const { palette } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? palette.accent : 'transparent', borderColor: selected ? palette.accentText : palette.borderStrong, borderWidth: selected ? 2 : 1 }]}>
      <Text maxFontSizeMultiplier={MAX} style={{ color: selected ? palette.onAccent : palette.text, fontFamily: selected ? fonts.uiSemibold : fonts.ui, fontSize: typography.captionSize + 1 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  flame: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekItem: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  weekDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, alignItems: 'center', gap: spacing.xs, minWidth: 120 },
  listRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
