import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, TextInput } from 'react-native';
import { AppText, Button, Heading } from '../components';
import { linkEmailPassword } from '../services/auth';
import { useServices } from '../services';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { Screen } from './Screen';

/**
 * Registration and linking. The anonymous user is converted in place (same user id), so progress and subscription links stay.
 * Apple and Google start the provider's linking flow in the system browser (supabase.auth.linkIdentity) and return through the
 * rabbai://auth/callback deep link. Apple appears on iOS because Google sign in is offered (App Store guideline 4.8).
 */
export function AccountScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Account'>) {
  const { t } = useTranslation();
  const { supabase } = useServices();
  const { palette } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = { borderWidth: 1, borderColor: palette.border, color: palette.text, borderRadius: 8, padding: 12, minHeight: 48 } as const;

  const create = async () => {
    setBusy(true);
    const r = await linkEmailPassword(supabase as never, email.trim(), password);
    setBusy(false);
    if (r.ok) navigation.goBack();
    else setError(t('errors.generic'));
  };

  const oauth = async (provider: 'apple' | 'google') => {
    const { data, error: e } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: 'rabbai://auth/callback', skipBrowserRedirect: true } });
    if (e || !data?.url) return setError(t('errors.generic'));
    await Linking.openURL(data.url);
  };

  return (
    <Screen>
      <Heading>{t('account.title')}</Heading>
      <AppText muted>{t('account.body')}</AppText>
      <TextInput accessibilityLabel={t('account.email')} placeholder={t('account.email')} placeholderTextColor={palette.textMuted} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} style={input} />
      <TextInput accessibilityLabel={t('account.password')} placeholder={t('account.password')} placeholderTextColor={palette.textMuted} secureTextEntry textContentType="newPassword" value={password} onChangeText={setPassword} style={input} />
      {error ? <AppText>{error}</AppText> : null}
      <Button label={t('account.create')} loading={busy} onPress={() => void create()} />
      {Platform.OS === 'ios' ? <Button label={t('account.apple')} variant="secondary" onPress={() => void oauth('apple')} /> : null}
      <Button label={t('account.google')} variant="secondary" onPress={() => void oauth('google')} />
      <Button label={t('account.skip')} variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
