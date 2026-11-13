import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AppText, Button, Card, EmptyState, ErrorState, formatClock, PermissionRow, PrayerText, ScriptureText, Skeleton, StatusBadge, StepIndicator, Timer } from './index';
import { ThemeProvider } from '../theme/ThemeProvider';

const t = (k: string, o?: Record<string, unknown>) => {
  const map: Record<string, string> = { 'a11y.step': `Step ${o?.current} of ${o?.total}: ${o?.label}`, 'a11y.stepDone': 'completed', 'a11y.stepCurrent': 'current', 'a11y.stepTodo': 'not started', 'a11y.timerValue': `${o?.minutes} minutes ${o?.seconds} seconds remaining` };
  return map[k] ?? k;
};
const wrap = async (ui: React.ReactElement) => {
  await render(<ThemeProvider>{ui}</ThemeProvider>);
  return screen;
};

describe('components expose screen reader labels', () => {
  it('Button has role, label and busy state', async () => {
    const { getByRole } = await wrap(<Button label="Start ritual" onPress={() => undefined} />);
    expect(getByRole('button', { name: 'Start ritual' })).toBeTruthy();
  });
  it('disabled Button reports disabled state', async () => {
    const { getByRole } = await wrap(<Button label="Go" disabled onPress={() => undefined} />);
    expect(getByRole('button', { name: 'Go' }).props.accessibilityState.disabled).toBe(true);
  });
  it('ScriptureText reads reference and text together and allows 200 percent font scale', async () => {
    const { getByLabelText, getByText } = await wrap(<ScriptureText text="The LORD is my shepherd." reference="Psalm 23:1" attribution="KJV" />);
    expect(getByLabelText('Psalm 23:1. The LORD is my shepherd.')).toBeTruthy();
    expect(getByText('The LORD is my shepherd.').props.maxFontSizeMultiplier).toBeGreaterThanOrEqual(2);
    expect(getByText('The LORD is my shepherd.').props.style.fontSize).toBe(20);
  });
  it('PrayerText is labelled', async () => {
    expect((await wrap(<PrayerText title="Before I scroll" body="Lord, help me." />)).getByLabelText('Before I scroll. Lord, help me.')).toBeTruthy();
  });
  it('StepIndicator announces the current step', async () => {
    const { getByLabelText } = await wrap(<StepIndicator t={t} steps={[{ key: 's', label: 'Scripture', state: 'done' }, { key: 'p', label: 'Prayer', state: 'current' }, { key: 't', label: 'Timer', state: 'todo' }]} />);
    expect(getByLabelText('Step 2 of 3: Prayer, current')).toBeTruthy();
  });
  it('Timer announces minutes and seconds', async () => {
    expect((await wrap(<Timer t={t} remainingSeconds={125} />)).getByLabelText('2 minutes 5 seconds remaining')).toBeTruthy();
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(-3)).toBe('0:00');
  });
  it('StatusBadge, PermissionRow, EmptyState, ErrorState, Skeleton, Card are labelled', async () => {
    const { getByLabelText, getByRole, getAllByRole } = await wrap(
      <>
        <StatusBadge kind="ok" label="Allowed" />
        <PermissionRow title="Usage Access" description="Needed to detect apps" stateLabel="Not allowed" granted={false} actionLabel="Allow" onAction={() => undefined} />
        <EmptyState title="Nothing yet" body="Come back later" />
        <ErrorState message="Offline" retryLabel="Try again" onRetry={() => undefined} />
        <Skeleton label="Loading reading" />
        <Card label="Summary"><AppText>x</AppText></Card>
      </>,
    );
    expect(getByLabelText('Allowed')).toBeTruthy();
    expect(getAllByRole('button', { name: 'Allow' })).toHaveLength(1);
    expect(getByRole('alert')).toBeTruthy();
    expect(getByLabelText('Loading reading')).toBeTruthy();
    expect(getByLabelText('Summary')).toBeTruthy();
  });
});
