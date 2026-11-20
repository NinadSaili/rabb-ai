/** Five-tab shell rendered through the real navigator: Home, Read, Pray, Journey, Profile. Premium surfaces are not reachable. */
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createDemoParts } from '../demo/demoParts';
import { initI18n } from '../i18n';
import { RootNavigator } from '../navigation/RootNavigator';
import { ServicesProvider } from '../serviceContext';
import { wireServices } from '../serviceWiring';
import { Analytics } from '../services/analytics/analytics';
import { MemoryKeyValueStore } from '../services/storage/kv';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: { configure: jest.fn(), getOfferings: jest.fn(async () => ({ current: null })), purchasePackage: jest.fn(), restorePurchases: jest.fn() } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

let client: QueryClient | null = null;

async function renderMain() {
  const kv = new MemoryKeyValueStore();
  const parts = createDemoParts(kv, () => 'America/New_York');
  const services = wireServices({ ...parts, analytics: new Analytics({ capture: () => undefined }, true), monotonicNow: () => 1000, nowMs: () => Date.UTC(2026, 10, 21, 14, 0, 0) });
  services.settings.getState().update({ onboardingDone: true, ageConfirmed: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={client}>
            <NavigationContainer><RootNavigator /></NavigationContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('main tabs', () => {
  beforeAll(() => { initI18n('en'); });
  afterEach(async () => { await cleanup(); client?.clear(); });

  it('shows exactly the five agreed tabs and no premium tab', async () => {
    await renderMain();
    for (const name of ['Home', 'Read', 'Pray', 'Journey', 'Profile']) {
      expect((await screen.findAllByRole('button', { name: new RegExp(`^${name}`) })).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText('Learn')).toBeNull();
    expect(screen.queryByText('Rabb.ai Premium')).toBeNull();
  });

  it('opens each tab and keeps premium entries out of Profile', async () => {
    await renderMain();
    const tab = async (name: string) => { await act(async () => { fireEvent.press((await screen.findAllByRole('button', { name: new RegExp(`^${name}`) }))[0] as never); }); };
    await tab('Read');
    expect((await screen.findAllByText('Bible reader')).length).toBeGreaterThan(0);
    await tab('Pray');
    expect((await screen.findAllByText('Pray')).length).toBeGreaterThan(0);
    await tab('Journey');
    expect((await screen.findAllByText('Journey')).length).toBeGreaterThan(0);
    await tab('Profile');
    expect((await screen.findByRole('button', { name: 'Delete account and data' }))).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rabb.ai Premium' })).toBeNull();
    // Permission status and emergency bypass stay reachable from Profile.
    expect(screen.getByRole('button', { name: 'Permissions and enforcement' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Privacy and emergency bypass' })).toBeTruthy();
  });
});
