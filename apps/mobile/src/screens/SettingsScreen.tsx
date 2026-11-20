import { deleteAccountResponse } from '@rabb/contracts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { AppText, Button, Card, Heading } from '../components';
import { features } from '../config';
import { useServices } from '../serviceContext';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from './Screen';

export function SettingsScreen({ navigation }: { navigation: NativeStackScreenProps<RootStackParamList, 'Main'>['navigation'] }) {
  const { t } = useTranslation();
  const { settings, api, supabase, kv } = useServices();
  const translation = settings((s) => s.translationCode);
  const scale = settings((s) => s.readingScale);
  const reminder = settings((s) => s.morningReminder);

  const remove = () => Alert.alert(t('settings.deleteAccount'), t('settings.deleteConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('settings.deleteAccount'),
      style: 'destructive',
      onPress: async () => {
        await api.post('/v1/account/delete', { confirm: 'DELETE' }, deleteAccountResponse);
        for (const k of kv.keys()) kv.delete(k);
        await supabase.auth.signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
      },
    },
  ]);

  return (
    <Screen>
      <Heading>{t('tabs.profile')}</Heading>
      <Card>
        <AppText weight="semibold">{t('settings.translation')}</AppText>
        <AppText muted>{translation}</AppText>
        <Button label={t('settings.translation')} variant="secondary" onPress={() => navigation.navigate('Translation')} />
      </Card>
      <Card>
        <AppText weight="semibold">{t('onboarding.tasteTitle')}</AppText>
        <Button label={`− ${Math.round(scale * 100)}% +`} variant="secondary" onPress={() => settings.getState().update({ readingScale: scale >= 2 ? 1 : Math.round((scale + 0.25) * 100) / 100 })} hint="Cycles the reading text size" />
      </Card>
      <Card>
        <AppText weight="semibold">{t('settings.notifications')}</AppText>
        <Button label={reminder ? t('permissions.granted') : t('permissions.denied')} variant="secondary" onPress={() => settings.getState().update({ morningReminder: !reminder })} />
      </Card>
      <Button label={t('settings.permissions')} variant="secondary" onPress={() => navigation.navigate('Capability')} />
      <Button label={t('schedules.title')} variant="secondary" onPress={() => navigation.navigate('Schedules')} />
      <Button label={t('settings.privacy')} variant="secondary" onPress={() => navigation.navigate('Privacy')} />
      <Button label={t('settings.account')} variant="secondary" onPress={() => navigation.navigate('Account')} />
      {features.premiumUi ? <Button label={t('paywall.title')} variant="secondary" onPress={() => navigation.navigate('Paywall', { source: 'settings' })} /> : null}
      <Button label={t('settings.deleteAccount')} variant="danger" onPress={remove} />
    </Screen>
  );
}
