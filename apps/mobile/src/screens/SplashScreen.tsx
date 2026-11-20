import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText, Heading } from '../components';
import { Linking } from 'react-native';
import { openDeepLink } from '../navigation/AppNavigation';
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
      if (!alive) return;
      const done = settings.getState().onboardingDone;
      navigation.replace(done ? 'Main' : 'Welcome');
      // A cold start from rabbai://ritual or rabbai://privacy (the Android block screen) lands on the requested screen.
      void Linking.getInitialURL().then((url) => openDeepLink(url, done)).catch(() => undefined);
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
