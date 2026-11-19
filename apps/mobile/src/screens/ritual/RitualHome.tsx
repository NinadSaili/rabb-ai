import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, EmptyState, ErrorState, Heading, Skeleton, StatusBadge, StepIndicator, type StepState } from '../../components';
import { loadDailyRitual } from '../../features/ritual/loadDaily';
import { listSchedules, toCoreSchedule } from '../../features/schedules/api';
import { useRitual, useServices } from '../../serviceContext';
import type { NativeStatus } from '../../services/blocking/types';
import type { MainTabParamList } from '../../navigation/types';
import { Screen } from '../Screen';

/** Always a fresh read from the native layer. Returns the status and a function to re-read it immediately. */
export function useNativeStatus(): [NativeStatus | null, () => void] {
  const { blocking } = useServices();
  const [s, setS] = useState<NativeStatus | null>(null);
  const alive = useRef(true);
  const read = useCallback(() => {
    void blocking.getRestrictionStatus().then((v) => alive.current && setS(v));
  }, [blocking]);
  useEffect(() => {
    alive.current = true;
    read();
    const id = setInterval(read, 5000);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [read]);
  return [s, read];
}

export function RitualHomeScreen({ navigation }: BottomTabScreenProps<MainTabParamList, 'Home'>) {
  const { t } = useTranslation();
  const services = useServices();
  const ritual = useRitual();
  const [native, refreshNative] = useNativeStatus();
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => loadDailyRitual(services.api, services.cache, services.kv, services.localToday) });

  useEffect(() => {
    // Register upcoming restriction windows with the OS layer whenever the schedule list is known.
    void listSchedules(services.api).then((list) => services.registerWindows(list.map(toCoreSchedule))).then(refreshNative).catch(() => undefined);
    ritual.checkRollover();
  }, [services, ritual, refreshNative]);

  const state = ritual.state;
  const done = daily.data?.session?.status === 'completed' || state.status === 'UNLOCKED' || state.status === 'RITUAL_COMPLETED';
  const inProgress = ['RITUAL_STARTED', 'SCRIPTURE_COMPLETED', 'PRAYER_COMPLETED', 'TIMER_COMPLETED'].includes(state.status);
  const timer = daily.data?.timerSeconds ?? null;
  const order: ['scripture', 'prayer', 'timer'] = ['scripture', 'prayer', 'timer'];
  const rank = { IDLE: 0, RITUAL_STARTED: 0, SCRIPTURE_COMPLETED: 1, PRAYER_COMPLETED: 2, TIMER_COMPLETED: 3 } as Record<string, number>;
  const steps = order.filter((k) => k !== 'timer' || timer !== null).map((k, i) => {
    const r = rank[state.status] ?? 3;
    const s: StepState = done || r > i ? 'done' : r === i ? 'current' : 'todo';
    return { key: k, label: t(`home.steps.${k}`), state: s };
  });

  const begin = () => {
    if (!daily.data || !daily.data.scheduleId) return;
    if (!inProgress) ritual.start({ scheduleId: daily.data.scheduleId, timerSeconds: timer, localDate: daily.data.localDate });
    const next = ritual.state.status === 'RITUAL_STARTED' ? 'Scripture' : ritual.state.status === 'SCRIPTURE_COMPLETED' ? 'Prayer' : 'Timer';
    navigation.getParent()?.navigate(next);
  };

  return (
    <Screen>
      <Heading>{t('home.title')}</Heading>
      {/* "Restricted" is shown only when the native layer reports it. Never from an API response or a local flag. */}
      {native ? <StatusBadge kind={native.restrictionApplied ? 'bad' : 'neutral'} label={native.restrictionApplied ? (native.simulated ? t('demo.restricted') : t('restriction.restricted')) : t('restriction.notApplied')} /> : null}
      {services.demo ? <Button label={t('demo.enter')} variant="secondary" onPress={() => navigation.getParent()?.navigate('DemoShield')} /> : null}
      {daily.isLoading ? <Skeleton height={96} label={t('common.loading')} /> : null}
      {daily.isError ? <EmptyState title={t('home.title')} body={t('home.offlineEmpty')} action={<Button label={t('common.retry')} onPress={() => void daily.refetch()} />} /> : null}
      {daily.data ? (
        <>
          <StepIndicator t={t as never} steps={steps} />
          {daily.data.offline ? <AppText muted>{t('errors.network')}</AppText> : null}
          {done ? <Card><AppText weight="semibold">{t('home.done')}</AppText></Card> : <Button testID="start-ritual" label={inProgress ? t('home.resume') : t('home.start')} disabled={!daily.data.scheduleId} onPress={begin} />}
          {state.status === 'RITUAL_COMPLETED' ? <Button label={t('completion.unlockButton')} onPress={() => navigation.getParent()?.navigate('Completion')} /> : null}
        </>
      ) : null}
      {daily.isError && !daily.data ? <ErrorState message={t('errors.generic')} retryLabel={t('common.retry')} onRetry={() => void daily.refetch()} /> : null}
    </Screen>
  );
}
