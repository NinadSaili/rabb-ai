import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText, Heading } from '../components';
import { ensureSession } from '../services/auth';
import { useServices } from '../serviceContext';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

export function SplashScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Splash'>) {
  const { t } = useTranslation();
  const { supabase, settings } = useServices();
  const { palette } = useTheme();
  useEffect(() => {
    let alive = true;
    void ensureSession(supabase as never).then(() => {
      if (alive) navigation.replace(settings.getState().onboardingDone ? 'Main' : 'Welcome');
    });
    return () => {
      alive = false;
    };
  }, [navigation, supabase, settings]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background, padding: 24 }}>
      <Heading>Rabb.ai</Heading>
      <AppText muted>{t('splash.tagline')}</AppText>
    </View>
  );
}
