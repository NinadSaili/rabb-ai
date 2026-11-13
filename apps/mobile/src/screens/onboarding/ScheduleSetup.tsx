import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput } from 'react-native';
import { AppText, Button, Heading } from '../../components';
import { analytics } from '../../services/analytics/analytics';
import { useServices } from '../../serviceContext';
import { uuidv4 } from '../../utils/id';
import { scheduleSchema } from '../../features/schedules/form';
import { createSchedule } from '../../features/schedules/api';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { Screen } from '../Screen';

export function ScheduleSetupScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ScheduleSetup'>) {
  const { t } = useTranslation();
  const { api, settings } = useServices();
  const { palette } = useTheme();
  const queryClient = useQueryClient();
  const [hour, setHour] = useState('6');
  const [timer, setTimer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = scheduleSchema.safeParse({ kind: 'morning', name: t('schedules.morning'), startHour: Number(hour), timerSeconds: timer === '' ? null : Number(timer) });
    if (!parsed.success) return setError(t('errors.generic'));
    setBusy(true);
    try {
      await createSchedule(api, parsed.data, uuidv4());
      // The onboarding taste cached today's content without a schedule. Home needs the schedule id and timer.
      await queryClient.invalidateQueries({ queryKey: ['daily'] });
      analytics.track('schedule_created', { kind: 'morning', weekday_count: 7 });
      settings.getState().update({ onboardingDone: true });
      analytics.track('onboarding_completed', { step_count: 5, timer_enabled: parsed.data.timerSeconds !== null });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch {
      setError(t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  const input = { borderWidth: 1, borderColor: palette.border, color: palette.text, borderRadius: 8, padding: 12, minHeight: 48 } as const;
  return (
    <Screen>
      <Heading>{t('onboarding.scheduleTitle')}</Heading>
      <AppText>{t('schedules.morning')}</AppText>
      <TextInput accessibilityLabel="Start hour, 0 to 23" keyboardType="number-pad" value={hour} onChangeText={setHour} style={input} />
      <TextInput accessibilityLabel={t('schedules.timerLabel')} placeholder={t('schedules.timerLabel')} placeholderTextColor={palette.textMuted} keyboardType="number-pad" value={timer} onChangeText={setTimer} style={input} />
      {error ? <Pressable accessibilityRole="alert"><AppText>{error}</AppText></Pressable> : null}
      <Button label={t('schedules.save')} loading={busy} onPress={() => void save()} />
    </Screen>
  );
}
