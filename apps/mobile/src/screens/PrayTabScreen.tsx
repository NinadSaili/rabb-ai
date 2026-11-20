import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, EmptyState, Heading, PrayerText, Skeleton } from '../components';
import { loadDailyRitual } from '../features/ritual/loadDaily';
import type { MainTabParamList } from '../navigation/types';
import { useServices } from '../serviceContext';
import { Screen } from './Screen';

/**
 * Pray tab: today's editorial prayer, read only. Completing the prayer counts toward the ritual only through the
 * ritual flow, so this tab never records a completion. Prayers are never presented as scripture.
 * Journal entries arrive in a later phase and stay private.
 */
export function PrayTabScreen({ navigation }: BottomTabScreenProps<MainTabParamList, 'Pray'>) {
  const { t } = useTranslation();
  const s = useServices();
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => loadDailyRitual(s.api, s.cache, s.kv, s.localToday) });
  const p = daily.data?.today.prayer;
  return (
    <Screen>
      <Heading>{t('pray.title')}</Heading>
      {daily.isLoading ? <Skeleton height={120} label={t('common.loading')} /> : null}
      {daily.isError ? <EmptyState title={t('pray.today')} body={t('pray.empty')} action={<Button label={t('common.retry')} variant="secondary" onPress={() => void daily.refetch()} />} /> : null}
      {p ? (
        <Card>
          <PrayerText title={p.title} body={p.body} />
          <AppText muted size={13} style={{ marginTop: 12 }}>{t('prayer.editorialNote')}</AppText>
        </Card>
      ) : null}
      {p ? <AppText muted>{t('pray.ritualHint')}</AppText> : null}
      {p ? <Button label={t('pray.goHome')} variant="secondary" onPress={() => navigation.navigate('Home')} /> : null}
    </Screen>
  );
}
