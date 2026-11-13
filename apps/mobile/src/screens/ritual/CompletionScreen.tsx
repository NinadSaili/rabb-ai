import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Heading, StatusBadge } from '../../components';
import type { UnlockStatus } from '../../features/ritual/ritualController';
import { useRitual, useServices } from '../../serviceContext';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

export function unlockMessageKey(u: UnlockStatus): { key: string; kind: 'ok' | 'warn' | 'bad' | 'neutral' } | null {
  switch (u.kind) {
    case 'unlocked_verified': return { key: 'completion.verified', kind: 'ok' };
    case 'unlocked_local_sync_pending': return { key: 'completion.pending', kind: 'warn' };
    case 'unlocked_simulated': return { key: 'completion.simulated', kind: 'warn' };
    case 'unlocked_local_not_recorded': return { key: 'completion.notRecorded', kind: 'warn' };
    case 'unlock_failed': return { key: 'completion.failed', kind: 'bad' };
    case 'not_enforced': return { key: 'completion.notEnforced', kind: 'neutral' };
    default: return null;
  }
}

export function CompletionScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Completion'>) {
  const { t } = useTranslation();
  const { settings, supabase } = useServices();
  const ritual = useRitual();
  const [busy, setBusy] = useState(false);
  const msg = unlockMessageKey(ritual.unlock);
  const unlocked = ritual.state.status === 'UNLOCKED';

  const unlock = async () => {
    setBusy(true);
    await ritual.requestUnlock();
    setBusy(false);
    const { data } = await supabase.auth.getSession();
    // Prompt to link an account after the first completed ritual (anonymous users only).
    if (ritual.state.status === 'UNLOCKED' && data.session?.user.is_anonymous && settings.getState().onboardingDone) {
      navigation.navigate('Account', { afterFirstRitual: true });
    }
  };

  return (
    <Screen>
      <Heading>{t('completion.title')}</Heading>
      {msg ? (
        <>
          <StatusBadge kind={msg.kind} label={t(msg.key, { reason: ritual.unlock.kind === 'unlock_failed' ? t(`restriction.reasons.${ritual.unlock.reason}`) : ritual.unlock.kind === 'unlocked_local_not_recorded' ? ritual.unlock.code : '' })} />
        </>
      ) : <AppText>{t('completion.unlockButton')}</AppText>}
      {!unlocked ? <Button label={ritual.state.status === 'UNLOCK_FAILED' ? t('completion.retry') : t('completion.unlockButton')} loading={busy} onPress={() => void unlock()} /> : <Button label={t('common.done')} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })} />}
      {ritual.state.status === 'UNLOCK_FAILED' ? <Button label={t('completion.bypass')} variant="secondary" onPress={() => navigation.navigate('Privacy')} /> : null}
    </Screen>
  );
}
