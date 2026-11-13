import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';
import { AppText, Button, Card, Heading, StatusBadge } from '../components';
import type { Capabilities, NativeStatus } from '../services/blocking/types';
import { useServices } from '../services';
import { Screen } from './Screen';

/** Enforcement status: says exactly what is and is not enforced on this device right now, read from the native layer. */
export function CapabilityScreen() {
  const { t } = useTranslation();
  const { blocking, settings } = useServices();
  const enabled = settings((s) => s.blockingEnabled);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const refresh = useCallback(async () => {
    setCaps(await blocking.getCapabilities());
    setStatus(await blocking.getRestrictionStatus());
  }, [blocking]);
  useEffect(() => void refresh(), [refresh]);
  return (
    <Screen>
      <Heading>{t('capability.title')}</Heading>
      {caps ? (
        <Card>
          <StatusBadge kind={caps.tier === 'tier0' ? 'warn' : 'ok'} label={t(`capability.${caps.tier}`)} />
          {caps.unmet.map((u) => <AppText key={u.message}>{u.message}</AppText>)}
        </Card>
      ) : null}
      {status ? (
        <Card>
          <StatusBadge kind={status.restrictionApplied ? 'bad' : 'neutral'} label={status.restrictionApplied ? t('restriction.restricted') : t('restriction.notApplied')} />
          {status.failure ? <AppText muted>{t(`restriction.reasons.${status.failure}`)}</AppText> : null}
          {status.lastHeartbeatMs ? <AppText muted size={13}>Last heartbeat {new Date(status.lastHeartbeatMs).toLocaleTimeString()}</AppText> : null}
        </Card>
      ) : null}
      {!enabled ? <AppText accessibilityLiveRegion="polite">{t('capability.blockingOff')}</AppText> : null}
      <Button
        label={enabled ? t('capability.turnOff') : t('capability.turnOn')}
        variant={enabled ? 'danger' : 'secondary'}
        onPress={() => {
          settings.getState().update({ blockingEnabled: !enabled });
          if (enabled) void blocking.disableBlocking().then(refresh);
        }}
      />
      <AppText muted>{t('capability.notGuaranteed')}</AppText>
      {Platform.OS === 'android' ? <AppText muted>{t('permissions.battery')}</AppText> : null}
      <Button label={t('permissions.openSettings')} variant="secondary" onPress={() => void Linking.openSettings()} />
      <Button label={t('common.retry')} variant="secondary" onPress={() => void refresh()} />
    </Screen>
  );
}
