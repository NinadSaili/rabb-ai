import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';
import { AppText, Button, Card, Heading, PermissionRow, StatusBadge } from '../../components';
import { analytics } from '../../services/analytics/analytics';
import { Pressable } from 'react-native';
import type { DemoBlockingService } from '../../demo/demoBlocking';
import type { Capabilities, PermissionKind, PermissionState, SelectedApplicationsInfo } from '../../services/blocking/types';
import { useServices } from '../../serviceContext';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

const KINDS: PermissionKind[] = Platform.OS === 'ios' ? ['family_controls', 'notifications'] : ['usage_access', 'overlay', 'notifications', 'battery_optimization'];

export function permissionCopyKey(kind: PermissionKind): string {
  return { family_controls: 'permissions.familyControls', usage_access: 'permissions.usageAccess', overlay: 'permissions.overlay', notifications: 'permissions.notifications', battery_optimization: 'permissions.battery' }[kind];
}

/** Prominent disclosure and consent come before every sensitive permission request. State is always read from the native layer. */
export function AppSelectionScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AppSelection'>) {
  const { t } = useTranslation();
  const { blocking, demo } = useServices();
  const demoBlocking = demo ? (blocking as unknown as DemoBlockingService) : null;
  const [demoSelected, setDemoSelected] = useState<string[]>(demoBlocking?.selectedIds() ?? []);
  const [states, setStates] = useState<Partial<Record<PermissionKind, PermissionState>>>({});
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [selection, setSelection] = useState<SelectedApplicationsInfo>({ count: 0, categoryCount: 0, webDomainCount: 0 });
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next: Partial<Record<PermissionKind, PermissionState>> = {};
    for (const k of KINDS) next[k] = await blocking.getPermissionState(k);
    setStates(next);
    setCaps(await blocking.getCapabilities());
    setSelection(await blocking.getSelectedApplicationDisplayNames());
  }, [blocking]);
  useEffect(() => void refresh(), [refresh]);

  const ask = async (kind: PermissionKind) => {
    const r = await blocking.requestPermission(kind);
    if (kind !== 'battery_optimization') {
      const permission_type = kind as 'family_controls' | 'usage_access' | 'overlay' | 'notifications';
      if (r === 'granted') analytics.track('permission_granted', { permission_type });
      else analytics.track('permission_denied', { permission_type });
    }
    await refresh();
  };

  const pick = async () => {
    const r = await blocking.presentAppPicker();
    if (r.result === 'failed') setMessage(t(`restriction.reasons.${r.failure}`));
    else setMessage(null);
    await refresh();
  };

  return (
    <Screen>
      <Heading>{t('onboarding.appsTitle')}</Heading>
      <AppText muted>{t('permissions.disclosureTitle')}</AppText>
      {KINDS.map((k) => (
        <PermissionRow
          key={k}
          title={k}
          description={t(permissionCopyKey(k))}
          granted={states[k] === 'granted'}
          stateLabel={states[k] === 'granted' ? t('permissions.granted') : t('permissions.denied')}
          actionLabel={t('permissions.grant')}
          onAction={() => void ask(k)}
        />
      ))}
      <Card>
        <AppText weight="semibold">{t('onboarding.appsTitle')}</AppText>
        {/* iOS tokens are opaque: only counts are shown here. Android may list labels, which never leave the device. */}
        <AppText muted>{selection.count} · {selection.categoryCount} · {selection.webDomainCount}</AppText>
        {selection.names?.map((n) => <AppText key={n}>{n}</AppText>)}
        {demoBlocking ? (
          <>
            <AppText muted size={13}>{t('demo.appsHelp')}</AppText>
            {demoBlocking.demoApps().map((a) => {
              const on = demoSelected.includes(a.id);
              return (
                <Pressable key={a.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={a.label} style={{ minHeight: 48, justifyContent: 'center' }}
                  onPress={() => { const next = on ? demoSelected.filter((x) => x !== a.id) : [...demoSelected, a.id]; setDemoSelected(next); demoBlocking.setSelected(next); void refresh(); }}>
                  <AppText>{on ? '☑ ' : '☐ '}{a.label}</AppText>
                </Pressable>
              );
            })}
          </>
        ) : (
          <Button label={t('onboarding.appsTitle')} onPress={() => void pick()} variant="secondary" />
        )}
        {message ? <AppText>{message}</AppText> : null}
      </Card>
      {caps ? (
        <Card label={t('capability.title')}>
          <StatusBadge kind={caps.tier === 'tier0' ? 'warn' : 'ok'} label={t(`capability.${caps.tier}`)} />
          {caps.unmet.map((u) => <AppText key={u.message} muted size={13}>{u.message}</AppText>)}
          <AppText muted size={13}>{t('capability.notGuaranteed')}</AppText>
        </Card>
      ) : null}
      <Button label={t('permissions.openSettings')} variant="secondary" onPress={() => void Linking.openSettings()} />
      <Button label={t('common.continue')} onPress={() => navigation.navigate('ScheduleSetup')} />
    </Screen>
  );
}
