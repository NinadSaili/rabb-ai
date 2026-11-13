import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { AppText, Button, Heading } from '../../components';
import { analytics } from '../../services/analytics/analytics';
import { useServices } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

export function WelcomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  const { t } = useTranslation();
  const { settings } = useServices();
  const [age, setAge] = useState(settings.getState().ageConfirmed);
  return (
    <Screen>
      <Heading>{t('onboarding.promiseTitle')}</Heading>
      <AppText>{t('onboarding.promiseBody')}</AppText>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: age }} accessibilityLabel={t('onboarding.ageGate')} onPress={() => setAge(!age)} style={{ minHeight: 48, justifyContent: 'center' }}>
        <AppText>{age ? '☑ ' : '☐ '}{t('onboarding.ageGate')}</AppText>
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
