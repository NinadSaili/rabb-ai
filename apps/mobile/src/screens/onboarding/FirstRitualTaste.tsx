import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, ErrorState, Heading, ScriptureText, Skeleton } from '../../components';
import { loadDailyRitual } from '../../features/ritual/loadDaily';
import { useServices } from '../../serviceContext';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

export function FirstRitualTasteScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'FirstRitualTaste'>) {
  const { t } = useTranslation();
  const { api, cache, kv, localToday } = useServices();
  const q = useQuery({ queryKey: ['daily'], queryFn: () => loadDailyRitual(api, cache, kv, localToday) });
  const v = q.data?.today.verse;
  return (
    <Screen>
      <Heading>{t('onboarding.tasteTitle')}</Heading>
      <AppText muted>{t('onboarding.tasteBody')}</AppText>
      {q.isLoading ? <Skeleton height={120} label={t('common.loading')} /> : null}
      {q.isError ? <ErrorState message={t('home.offlineEmpty')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {v ? <ScriptureText text={v.text} reference={`${v.reference.book} ${v.reference.chapter}:${v.reference.verse_start}${v.reference.verse_end ? `-${v.reference.verse_end}` : ''}`} attribution={v.translation.attribution_text} /> : null}
      <Button label={t('common.continue')} disabled={!v} onPress={() => navigation.navigate('AppSelection')} />
    </Screen>
  );
}
