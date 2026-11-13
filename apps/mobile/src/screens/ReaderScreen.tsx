import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Card, ErrorState, Heading, ScriptureText, Skeleton } from '../components';
import { loadDailyRitual } from '../features/ritual/loadDaily';
import { useServices } from '../services';
import { Screen } from './Screen';

/** Basic Bible reader for cached and prefetched passages. Attribution is rendered under every passage. */
export function ReaderScreen() {
  const { t } = useTranslation();
  const s = useServices();
  const q = useQuery({ queryKey: ['daily'], queryFn: () => loadDailyRitual(s.api, s.cache, s.kv, s.localToday) });
  const dates = s.cache.dates();
  return (
    <Screen>
      <Heading>{t('reader.title')}</Heading>
      {q.isLoading ? <Skeleton height={96} /> : null}
      {q.isError ? <ErrorState message={t('home.offlineEmpty')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {dates.map((d) => {
        const day = s.cache.get(d);
        if (!day) return null;
        const v = day.verse;
        return (
          <Card key={d}>
            <AppText muted size={13}>{d}</AppText>
            <ScriptureText text={v.text} reference={`${v.reference.book} ${v.reference.chapter}:${v.reference.verse_start}${v.reference.verse_end ? `-${v.reference.verse_end}` : ''}`} attribution={`${t('reader.attribution')}: ${v.translation.attribution_text}`} />
          </Card>
        );
      })}
    </Screen>
  );
}
