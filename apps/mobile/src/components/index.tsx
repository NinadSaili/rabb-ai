import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, fonts, radius, spacing, typography, motionDuration, motion } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

const MAX = typography.maxFontSizeMultiplier;

export function Button(props: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; loading?: boolean; hint?: string; testID?: string }) {
  const { palette } = useTheme();
  const v = props.variant ?? 'primary';
  const bg = v === 'primary' ? palette.accent : v === 'danger' ? palette.danger : 'transparent';
  const fg = v === 'primary' ? palette.onAccent : v === 'danger' ? palette.background : palette.accentText;
  const border = v === 'primary' ? palette.accent : v === 'danger' ? palette.danger : palette.accentText;
  const inactive = props.disabled || props.loading;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ disabled: !!inactive, busy: !!props.loading }}
      disabled={inactive}
      onPress={props.onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: border, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      <Text maxFontSizeMultiplier={MAX} style={[styles.buttonText, { color: fg }]}>{props.loading ? '…' : props.label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, label }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; label?: string }) {
  const { palette } = useTheme();
  return (
    <View accessible={!!label} accessibilityLabel={label} style={[styles.card, elevation.card, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>
      {children}
    </View>
  );
}

export function AppText({ children, muted, size, weight, style, accessibilityLiveRegion }: { children: React.ReactNode; muted?: boolean; size?: number; weight?: 'regular' | 'medium' | 'semibold' | 'bold'; style?: object; accessibilityLiveRegion?: 'none' | 'polite' | 'assertive' }) {
  const { palette } = useTheme();
  const family = weight === 'bold' ? fonts.uiBold : weight === 'semibold' ? fonts.uiSemibold : weight === 'medium' ? fonts.uiMedium : fonts.ui;
  return <Text accessibilityLiveRegion={accessibilityLiveRegion} maxFontSizeMultiplier={MAX} style={[{ color: muted ? palette.textMuted : palette.text, fontFamily: family, fontSize: size ?? typography.bodySize, lineHeight: (size ?? typography.bodySize) * 1.5 }, style]}>{children}</Text>;
}

export function Heading({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  return <Text accessibilityRole="header" maxFontSizeMultiplier={MAX} style={{ color: palette.text, fontFamily: fonts.uiSemibold, fontSize: typography.titleSize, lineHeight: typography.titleSize * 1.3 }}>{children}</Text>;
}

/** Scripture in a serif at 20pt by default. Scales with system font size and the reading setting, to at least 200 percent. */
export function ScriptureText(props: { text: string; reference: string; attribution?: string }) {
  const { palette, readingScale } = useTheme();
  return (
    <View accessible accessibilityLabel={`${props.reference}. ${props.text}`}>
      <Text maxFontSizeMultiplier={MAX} style={{ color: palette.text, fontFamily: fonts.scripture, fontSize: typography.scriptureSize * readingScale, lineHeight: typography.scriptureLineHeight * readingScale }}>{props.text}</Text>
      <Text maxFontSizeMultiplier={MAX} style={{ color: palette.textMuted, fontFamily: fonts.uiMedium, fontSize: typography.captionSize + 1, marginTop: spacing.sm }}>{props.reference}</Text>
      {props.attribution ? <Text maxFontSizeMultiplier={MAX} style={{ color: palette.textMuted, fontFamily: fonts.ui, fontSize: typography.captionSize, marginTop: spacing.xs }}>{props.attribution}</Text> : null}
    </View>
  );
}

export function PrayerText({ title, body }: { title: string; body: string }) {
  const { palette, readingScale } = useTheme();
  return (
    <View accessible accessibilityLabel={`${title}. ${body}`}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX} style={{ color: palette.text, fontFamily: fonts.scriptureStrong, fontSize: 22 * readingScale, marginBottom: spacing.sm }}>{title}</Text>
      <Text maxFontSizeMultiplier={MAX} style={{ color: palette.text, fontFamily: fonts.scriptureItalic, fontSize: typography.scriptureSize * readingScale, lineHeight: typography.scriptureLineHeight * readingScale }}>{body}</Text>
    </View>
  );
}

export type StepState = 'done' | 'current' | 'todo';
export function StepIndicator({ steps, t }: { steps: { key: string; label: string; state: StepState }[]; t: (k: string, o?: Record<string, unknown>) => string }) {
  const { palette } = useTheme();
  const current = Math.max(1, steps.findIndex((s) => s.state === 'current') + 1 || steps.filter((s) => s.state === 'done').length);
  const cur = steps.find((s) => s.state === 'current') ?? steps[current - 1];
  const stateWord = (s: StepState) => t(s === 'done' ? 'a11y.stepDone' : s === 'current' ? 'a11y.stepCurrent' : 'a11y.stepTodo');
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${t('a11y.step', { current, total: steps.length, label: cur?.label ?? '' })}, ${cur ? stateWord(cur.state) : ''}`} style={styles.row}>
      {steps.map((s) => (
        <View key={s.key} style={styles.stepItem}>
          <View style={[styles.dot, { backgroundColor: s.state === 'todo' ? 'transparent' : palette.accent, borderColor: palette.accentText }]} />
          <Text maxFontSizeMultiplier={MAX} style={{ color: s.state === 'current' ? palette.text : palette.textMuted, fontFamily: s.state === 'current' ? fonts.uiSemibold : fonts.ui, fontSize: typography.captionSize }}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Timer({ remainingSeconds, t }: { remainingSeconds: number; t: (k: string, o?: Record<string, unknown>) => string }) {
  const { palette } = useTheme();
  const s = Math.max(0, Math.ceil(remainingSeconds));
  return (
    <View accessible accessibilityRole={'timer' as AccessibilityRole} accessibilityLabel={t('a11y.timerValue', { minutes: Math.floor(s / 60), seconds: s % 60 })}>
      <Text maxFontSizeMultiplier={MAX} style={{ color: palette.text, fontFamily: fonts.uiBold, fontSize: 56, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{formatClock(s)}</Text>
    </View>
  );
}

export function StatusBadge({ kind, label }: { kind: 'ok' | 'warn' | 'bad' | 'neutral'; label: string }) {
  const { palette } = useTheme();
  const color = kind === 'ok' ? palette.success : kind === 'warn' ? palette.warning : kind === 'bad' ? palette.danger : palette.textMuted;
  return (
    <View accessible accessibilityLabel={label} style={[styles.badge, { borderColor: color }]}>
      <Text maxFontSizeMultiplier={MAX} style={{ color, fontFamily: fonts.uiSemibold, fontSize: typography.captionSize }}>{label}</Text>
    </View>
  );
}

export function PermissionRow(props: { title: string; description: string; stateLabel: string; granted: boolean; actionLabel: string; onAction: () => void }) {
  return (
    <Card>
      <AppText weight="semibold">{props.title}</AppText>
      <AppText muted size={14}>{props.description}</AppText>
      <View style={{ height: spacing.sm }} />
      <View style={styles.rowBetween}>
        <StatusBadge kind={props.granted ? 'ok' : 'warn'} label={props.stateLabel} />
        {!props.granted ? <Button label={props.actionLabel} onPress={props.onAction} variant="secondary" /> : null}
      </View>
    </Card>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View accessible={false} style={styles.center}>
      <Heading>{title}</Heading>
      {body ? <AppText muted style={{ textAlign: 'center', marginTop: spacing.sm }}>{body}</AppText> : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  const { palette } = useTheme();
  return (
    <View style={styles.center}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" maxFontSizeMultiplier={MAX} style={{ color: palette.danger, fontFamily: fonts.uiSemibold, fontSize: typography.bodySize, textAlign: 'center' }}>{message}</Text>
      <View style={{ marginTop: spacing.md }}><Button label={retryLabel} onPress={onRetry} variant="secondary" /></View>
    </View>
  );
}

export function Skeleton({ width = '100%', height = 20, label = 'Loading' }: { width?: number | `${number}%`; height?: number; label?: string }) {
  const { palette, reduceMotion } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.6);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: motionDuration(motion.normal * 4, reduceMotion), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.5, duration: motionDuration(motion.normal * 4, reduceMotion), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ width, height, borderRadius: radius.sm, backgroundColor: palette.surfaceAlt, opacity }} />;
}

const styles = StyleSheet.create({
  button: { minHeight: 52, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.uiSemibold, fontSize: typography.bodySize },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginVertical: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  stepItem: { alignItems: 'center', flex: 1, gap: spacing.xs },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  badge: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start' },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});

export * from './visuals';
