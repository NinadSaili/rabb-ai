import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nextRestrictionTime } from '@rabb/schedule-core';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from 'react-native';
import { AppText, Button, Card, ErrorState, Heading, Skeleton } from '../components';
import { createSchedule, listSchedules, toCoreSchedule } from '../features/schedules/api';
import { scheduleSchema } from '../features/schedules/form';
import { analytics } from '../services/analytics/analytics';
import { useServices } from '../services';
import { useTheme } from '../theme/ThemeProvider';
import { uuidv4 } from '../utils/id';
import { Screen } from './Screen';

export function SchedulesScreen() {
  const { t } = useTranslation();
  const { api, timeZone, registerWindows } = useServices();
  const { palette } = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['schedules'], queryFn: () => listSchedules(api) });
  const [name, setName] = useState('');
  const [hour, setHour] = useState('20');
  const [error, setError] = useState<string | null>(null);
  const input = { borderWidth: 1, borderColor: palette.border, color: palette.text, borderRadius: 8, padding: 12, minHeight: 48 } as const;

  const next = q.data ? nextRestrictionTime({ nowMs: Date.now(), timeZone: timeZone(), schedules: q.data.map(toCoreSchedule), completions: [] }) : null;

  const add = async () => {
    const parsed = scheduleSchema.safeParse({ kind: 'custom', name, startHour: Number(hour), timerSeconds: null, unlockUntilMidnight: false });
    if (!parsed.success) return setError(t('errors.generic'));
    try {
      await createSchedule(api, parsed.data, uuidv4());
      analytics.track('schedule_created', { kind: 'custom', weekday_count: parsed.data.weekdays.length });
      setName('');
      setError(null);
      await qc.invalidateQueries({ queryKey: ['schedules'] });
      await registerWindows((await listSchedules(api)).map(toCoreSchedule));
    } catch {
      setError(t('errors.generic'));
    }
  };

  return (
    <Screen>
      <Heading>{t('schedules.title')}</Heading>
      {q.isLoading ? <Skeleton height={64} /> : null}
      {q.isError ? <ErrorState message={t('errors.network')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {next ? <AppText muted>{t('schedules.nextRestriction')}: {new Date(next.atMs).toLocaleString()}</AppText> : null}
      {q.data?.map((s) => (
        <Card key={s.id} label={`${s.name}, ${Math.floor(s.start_minute / 60)}:${String(s.start_minute % 60).padStart(2, '0')}`}>
          <AppText weight="semibold">{s.name}</AppText>
          <AppText muted>{Math.floor(s.start_minute / 60)}:{String(s.start_minute % 60).padStart(2, '0')} to {Math.floor(s.end_minute / 60) % 24}:{String(s.end_minute % 60).padStart(2, '0')}{s.unlock_until === 'midnight' ? ` · ${t('schedules.untilMidnight')}` : ''}</AppText>
        </Card>
      ))}
      <Heading>{t('schedules.add')}</Heading>
      <TextInput accessibilityLabel="Name" placeholder="Name" placeholderTextColor={palette.textMuted} value={name} onChangeText={setName} style={input} />
      <TextInput accessibilityLabel="Start hour, 0 to 23" keyboardType="number-pad" value={hour} onChangeText={setHour} style={input} />
      {error ? <AppText>{error}</AppText> : null}
      <Button label={t('schedules.save')} onPress={() => void add()} />
    </Screen>
  );
}
