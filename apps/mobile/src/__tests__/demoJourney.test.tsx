/**
 * Automated UI test of the demonstration journey, rendered through the real navigator, screens and services:
 * Onboarding, select apps, set the morning schedule, open the ritual, scripture, prayer, optional timer, completion, unlock.
 * It runs in DEMO MODE parts (local API, SIMULATED restrictions). It proves the flow and the honesty of the labels.
 * It does not prove native app blocking.
 */
import { habitsSummaryResponse } from '@rabb/contracts';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createDemoParts } from '../demo/demoParts';
import { initI18n } from '../i18n';
import { RootNavigator } from '../navigation/RootNavigator';
import { ServicesProvider, type Services } from '../serviceContext';
import { wireServices } from '../serviceWiring';
import { Analytics, analytics as globalAnalytics } from '../services/analytics/analytics';
import { MemoryKeyValueStore } from '../services/storage/kv';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: { configure: jest.fn(), getOfferings: jest.fn(async () => ({ current: null })), purchasePackage: jest.fn(), restorePurchases: jest.fn() } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const NOW = Date.UTC(2026, 10, 21, 14, 0, 0); // 21 November 2026, afternoon in New York
let mono = 1000;

function setup() {
  const kv = new MemoryKeyValueStore();
  const events: string[] = [];
  const sink = { capture: (e: string) => { events.push(e); } };
  const analytics = new Analytics(sink, true);
  globalAnalytics.setSink(sink); // onboarding screens use the shared instance
  const parts = createDemoParts(kv, () => 'America/New_York');
  const services: Services = wireServices({ ...parts, analytics, monotonicNow: () => mono, nowMs: () => NOW });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <NavigationContainer><RootNavigator /></NavigationContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return { services, tree, events, kv, queryClient };
}

const press = async (name: string | RegExp) => {
  await act(async () => { fireEvent.press(await screen.findByRole('button', { name })); });
};

let activeClient: QueryClient | null = null;

describe('demo journey', () => {
  beforeAll(() => { initI18n('en'); });
  afterEach(async () => { await cleanup(); activeClient?.clear(); jest.useRealTimers(); });

  it('walks onboarding, schedule, ritual, timer and unlock, labelling everything as simulated', async () => {
    const { services, tree, events, queryClient } = setup();
    activeClient = queryClient;
    await render(tree);

    // 1 Onboarding promise and age gate. Demo banner is visible from the first screen.
    expect(await screen.findByText('Before the scroll, seek the Word.')).toBeTruthy();
    expect(screen.getByText(/DEMO MODE/)).toBeTruthy();
    const begin = await screen.findByRole('button', { name: 'Begin' });
    expect(begin.props.accessibilityState.disabled).toBe(true);
    await act(async () => { fireEvent.press(screen.getByRole('checkbox', { name: 'I am 13 or older' })); });
    await press('Begin');

    // 2 Translation
    expect(await screen.findByText('Choose a Bible translation')).toBeTruthy();
    expect(await screen.findByText(/DEV ONLY/)).toBeTruthy();
    await press('Continue');

    // 3 First ritual taste: today's verse with attribution that says it is placeholder content
    expect(await screen.findByText("Today's verse")).toBeTruthy();
    expect(await screen.findByText(/DEMO placeholder text/)).toBeTruthy();
    await waitFor(async () => expect((await screen.findByRole('button', { name: 'Continue' })).props.accessibilityState.disabled).toBe(false));
    await press('Continue');

    // 4 Select distracting apps (simulated list) and permissions
    expect((await screen.findAllByText('Choose apps to restrict')).length).toBeGreaterThan(0);
    await act(async () => { fireEvent.press(await screen.findByRole('checkbox', { name: 'Social feed (demo)' })); });
    await act(async () => { fireEvent.press(await screen.findByRole('checkbox', { name: 'Short videos (demo)' })); });
    await waitFor(async () => expect((await services.blocking.getSelectedApplicationDisplayNames()).count).toBe(2));
    await press('Continue');

    // 5 Morning schedule with a 30 second reading timer
    expect(await screen.findByText('When should your ritual start?')).toBeTruthy();
    await act(async () => { fireEvent.changeText(screen.getByLabelText('Reading timer (seconds, optional)'), '30'); });
    await press('Save schedule');

    // 6 Home: restriction is shown as simulated, never as a real restriction
    expect((await screen.findAllByText('Daily ritual')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Restricted (simulated)')).toBeTruthy();
    expect(screen.queryByText('Restricted by your device')).toBeNull();
    await waitFor(async () => expect((await screen.findByTestId('start-ritual')).props.accessibilityState.disabled).toBe(false));
    await press('Start ritual');

    // 7 Scripture
    expect(await screen.findByText('Scripture')).toBeTruthy();
    expect(await screen.findByText(/DEMO placeholder text/)).toBeTruthy();
    await press('I have read this');

    // 8 Prayer
    expect(await screen.findByText('Prayer')).toBeTruthy();
    await press('Amen');

    // 9 Timer: finishing early is impossible
    expect(await screen.findByText('Reading time')).toBeTruthy();
    expect((await screen.findByRole('button', { name: 'Finish' })).props.accessibilityState.disabled).toBe(true);
    jest.useFakeTimers();
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Start timer' })); });
    mono += 10_000;
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(screen.getByRole('button', { name: 'Finish' }).props.accessibilityState.disabled).toBe(true);
    mono += 20_500;
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(screen.getByRole('button', { name: 'Finish' }).props.accessibilityState.disabled).toBe(false);
    jest.useRealTimers();
    await press('Finish');

    // 10 Completion and unlock confirmation. The claim is "simulated", never "verified by your device".
    expect(await screen.findByText('Well done')).toBeTruthy();
    await press('Unlock my apps');
    expect(await screen.findByText(/Unlocked \(simulated\)/)).toBeTruthy();
    expect(screen.queryByText(/verified by your device/)).toBeNull();
    expect(services.ritual.state.status).toBe('UNLOCKED');
    expect((await services.blocking.getRestrictionStatus()).restrictionApplied).toBe(false);

    // The ritual was recorded by the demo API with the timer flagged as not server verified.
    await waitFor(async () => expect(services.queue.size()).toBe(0));
    const habits = await services.api.get('/v1/habits/summary', habitsSummaryResponse);
    expect(habits.current_streak).toBe(1);
    expect(events).toEqual(expect.arrayContaining(['onboarding_started', 'schedule_created', 'onboarding_completed', 'ritual_started', 'scripture_completed', 'prayer_completed', 'ritual_completed', 'restriction_removed']));
  });
});
