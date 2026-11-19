import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { config } from '../config';
import { initI18n } from '../i18n';
import { RootNavigator } from '../navigation/RootNavigator';
import { ServicesProvider, createServices } from '../services';
import { analytics } from '../services/analytics/analytics';
import { createPostHogSink } from '../services/analytics/posthog';
import { initSentry } from '../services/sentry/init';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ErrorBoundary } from './ErrorBoundary';

initSentry(config.sentryDsn);
initI18n('en');

export function App() {
  const services = useMemo(() => createServices(), []);
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }), []);
  useEffect(() => {
    if (config.posthogKey) analytics.setSink(createPostHogSink(config.posthogKey, config.posthogHost));
  }, []);
  const scale = services.settings((s) => s.readingScale);
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider readingScale={scale}>
          <ServicesProvider services={services}>
            <QueryClientProvider client={queryClient}>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </QueryClientProvider>
          </ServicesProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
