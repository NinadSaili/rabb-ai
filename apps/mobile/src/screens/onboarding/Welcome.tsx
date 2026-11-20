import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText, Button, Card, Heading, Icon } from '../../components';
import { analytics } from '../../services/analytics/analytics';
import { useServices } from '../../serviceContext';
import type { RootStackParamList } from '../../navigation/types';
import { radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { Screen } from '../Screen';

export function WelcomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  const { t } = useTranslation();
  const { settings } = useServices();
  const { palette } = useTheme();
  const [age, setAge] = useState(settings.getState().ageConfirmed);
  const how = [
    { icon: 'lock', title: t('onboarding.how1Title'), body: t('onboarding.how1Body') },
    { icon: 'book', title: t('onboarding.how2Title'), body: t('onboarding.how2Body') },
    { icon: 'check', title: t('onboarding.how3Title'), body: t('onboarding.how3Body') },
  ] as const;
  return (
    <Screen>
      <Heading>{t('onboarding.promiseTitle')}</Heading>
      <AppText muted>{t('onboarding.promiseBody')}</AppText>
      <Card>
        <AppText weight="semibold">{t('onboarding.howTitle')}</AppText>
        {how.map((h) => (
          <View key={h.title} style={{ flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={h.icon} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="semibold">{h.title}</AppText>
              <AppText muted size={14}>{h.body}</AppText>
            </View>
          </View>
        ))}
      </Card>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: age }} accessibilityLabel={t('onboarding.ageGate')} onPress={() => setAge(!age)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 28, height: 28, borderRadius: radius.sm, borderWidth: 2, borderColor: age ? palette.accentText : palette.borderStrong, backgroundColor: age ? palette.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {age ? <Icon name="check" size={18} color={palette.onAccent} strokeWidth={2.6} /> : null}
        </View>
        <AppText>{t('onboarding.ageGate')}</AppText>
      </Pressable>
      <Button
        label={t('onboarding.start')}
        disabled={!age}
        onPress={() => {
          settings.getState().update({ ageConfirmed: true });
          analytics.track('onboarding_started');
          navigation.navigate('Translation');
        }}
      />
    </Screen>
  );
}
