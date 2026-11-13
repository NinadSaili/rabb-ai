import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable } from 'react-native';
import { AppText, Card, Heading } from '../components';
import { BYPASS_HOLD_MS } from '../features/ritual/emergencyBypass';
import { useServices } from '../services';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/** Emergency bypass: hold 5 seconds, then confirm. No network needed. Counts and log stay on this device. */
export function PrivacyScreen() {
  const { t } = useTranslation();
  const { bypass, schedules, timeZone } = useServices();
  const { palette } = useTheme();
  const [progress, setProgress] = useState(0);
  const [count, setCount] = useState(bypass.countToday());
  const started = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const finish = (heldMs: number) => {
    stop();
    started.current = null;
    setProgress(0);
    if (heldMs < BYPASS_HOLD_MS) return;
    Alert.alert(t('privacy.bypassTitle'), t('privacy.bypassBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('privacy.confirm'),
        style: 'destructive',
        onPress: async () => {
          const { bypassEndFor } = await import('@rabb/schedule-core');
          const until = bypassEndFor({ nowMs: Date.now(), timeZone: timeZone(), schedules: schedules.current, completions: [] });
          await bypass.perform({ heldMs, confirmed: true }, until);
          setCount(bypass.countToday());
        },
      },
    ]);
  };

  return (
    <Screen>
      <Heading>{t('privacy.title')}</Heading>
      <AppText>{t('privacy.appsNever')}</AppText>
      <Card>
        <AppText weight="semibold">{t('privacy.bypassTitle')}</AppText>
        <AppText muted>{t('privacy.bypassBody')}</AppText>
        <Pressable
          testID="bypass-hold"
          accessibilityRole="button"
          accessibilityLabel={t('privacy.hold')}
          accessibilityHint={t('privacy.bypassBody')}
          onPressIn={() => {
            started.current = Date.now();
            timer.current = setInterval(() => setProgress(Math.min(1, (Date.now() - (started.current ?? Date.now())) / BYPASS_HOLD_MS)), 100);
          }}
          onPressOut={() => finish(started.current ? Date.now() - started.current : 0)}
          style={{ minHeight: 56, borderRadius: 12, borderWidth: 2, borderColor: palette.danger, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 12 }}
        >
          <AppText weight="semibold">{t('privacy.hold')}{progress > 0 ? ` ${Math.round(progress * 100)}%` : ''}</AppText>
        </Pressable>
        <AppText muted size={13}>{t('privacy.usedToday', { count })}</AppText>
      </Card>
    </Screen>
  );
}
