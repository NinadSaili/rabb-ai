import { DefaultTheme, DarkTheme, NavigationContainer, createNavigationContainerRef, type Theme as NavTheme } from '@react-navigation/native';
import React, { useEffect, useMemo } from 'react';
import { Linking } from 'react-native';
import { useServices } from '../serviceContext';
import { useTheme } from '../theme/ThemeProvider';
import { resolveDeepLink } from './deepLinks';
import { RootNavigator } from './RootNavigator';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Opens a deep link on an already running navigator. The cold start link is handled once after the splash screen. */
export function openDeepLink(url: string | null | undefined, onboardingDone: boolean): boolean {
  const target = resolveDeepLink(url, onboardingDone);
  if (!target || !navigationRef.isReady()) return false;
  if (target.kind === 'privacy') navigationRef.navigate('Privacy');
  else navigationRef.navigate('Main');
  return true;
}

export function AppNavigation() {
  const { palette, mode } = useTheme();
  const { settings } = useServices();
  const theme = useMemo<NavTheme>(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: palette.accentText, background: palette.background, card: palette.surface, text: palette.text, border: palette.border, notification: palette.highlight } };
  }, [palette, mode]);
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      openDeepLink(url, settings.getState().onboardingDone);
    });
    return () => sub.remove();
  }, [settings]);
  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <RootNavigator />
    </NavigationContainer>
  );
}
