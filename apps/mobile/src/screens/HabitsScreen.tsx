import { habitsSummaryResponse } from '@rabb/contracts';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText, Card, EmptyState, ErrorState, Heading, Skeleton } from '../components';
import { useServices } from '../serviceContext';
import { Screen } from './Screen';

export function HabitsScreen() {
  const { t } = useTranslation();
  const { api } = useServices();
  const q = useQuery({ queryKey: ['habits'], queryFn: () => api.get('/v1/habits/summary', habitsSummaryResponse) });
  const glyph = { completed: '●', grace: '◐', missed: '○', pending: '·', none: '·' } as const;
  return (
    <Screen>
      <Heading>{t('habits.title')}</Heading>
      {q.isLoading ? <Skeleton height={96} /> : null}
      {q.isError ? <ErrorState message={t('errors.network')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {q.data ? (
        <>
          <Card label={`${t('habits.current')}: ${q.data.current_streak}. ${t('habits.longest')}: ${q.data.longest_streak}`}>
            <AppText size={32} weight="bold">{q.data.current_streak}</AppText>
            <AppText muted>{t('habits.current')} · {t('habits.longest')}: {q.data.longest_streak}</AppText>
            <AppText muted size={13}>{t('habits.grace')}</AppText>
          </Card>
          <Card>
            <AppText weight="semibold">{t('habits.week')}</AppText>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {q.data.week.map((d) => (
                <View key={d.date} accessible accessibilityLabel={`${d.date}, ${d.status}`} style={{ alignItems: 'center', minWidth: 36 }}>
                  <AppText size={22}>{glyph[d.status]}</AppText>
                  <AppText muted size={11}>{d.date.slice(8)}</AppText>
                </View>
              ))}
            </View>
          </Card>
          <AppText muted>{t('habits.last30')}: {q.data.completed_last_30_days}</AppText>
        </>
      ) : null}
      {!q.isLoading && !q.data && !q.isError ? <EmptyState title={t('habits.title')} /> : null}
    </Screen>
  );
}
