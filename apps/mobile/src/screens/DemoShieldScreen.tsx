import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Heading, StatusBadge } from '../components';
import { DEMO_APPS } from '../demo/apps';
import type { NativeStatus } from '../services/blocking/types';
import { useServices } from '../serviceContext';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from './Screen';

/** DEMO MODE ONLY. Shows what the restriction looks like. It is a simulation inside Rabb.ai, not a real overlay on another app. */
export function DemoShieldScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'DemoShield'>) {
  const { t } = useTranslation();
  const { blocking, resetDemo } = useServices();
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [tried, setTried] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setStatus(await blocking.getRestrictionStatus());
    setNames((await blocking.getSelectedApplicationDisplayNames()).names ?? []);
  }, [blocking]);
  useEffect(() => void refresh(), [refresh]);
  const list = names.length ? names : DEMO_APPS.map((a) => a.label);
  return (
    <Screen>
      <Heading>{t('demo.shieldTitle')}</Heading>
      {status ? <StatusBadge kind={status.restrictionApplied ? 'bad' : 'neutral'} label={status.restrictionApplied ? t('demo.restricted') : t('restriction.notApplied')} /> : null}
      {list.map((n) => <Button key={n} label={t('demo.shieldOpen', { app: n })} variant="secondary" onPress={() => { setTried(n); void refresh(); }} />)}
      {tried ? (
        <Card>
          <AppText accessibilityLiveRegion="polite" weight="semibold">{status?.restrictionApplied ? t('demo.shieldBlocked') : t('demo.shieldFree', { app: tried })}</AppText>
          {status?.restrictionApplied ? <Button label={t('demo.shieldRitual')} onPress={() => navigation.navigate('Main')} /> : null}
          {status?.restrictionApplied ? <Button label={t('completion.bypass')} variant="secondary" onPress={() => navigation.navigate('Privacy')} /> : null}
        </Card>
      ) : null}
      <AppText muted size={13}>{t('demo.resetHelp')}</AppText>
      <Button label={t('demo.reset')} variant="danger" onPress={() => { resetDemo(); navigation.reset({ index: 0, routes: [{ name: 'Splash' }] }); }} />
    </Screen>
  );
}
