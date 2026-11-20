import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Chip, Icon, ListRow, MilestoneBadge, ProgressRing, StreakCard, WeekStrip, type IconName } from './index';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('visual components', () => {
  it('ProgressRing exposes clamped progress to assistive tech', async () => {
    await wrap(<ProgressRing progress={1.7} label="Ritual 100 percent complete" />);
    const ring = screen.getByRole('progressbar');
    expect(ring.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
    expect(ring.props.accessibilityLabel).toBe('Ritual 100 percent complete');
  });

  it('ProgressRing at zero draws no arc and reports 0', async () => {
    await wrap(<ProgressRing progress={-1} label="Not started" />);
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(0);
  });

  it('StreakCard reads as one labelled element and uses gentle copy', async () => {
    await wrap(<StreakCard title="3 day streak" subtitle="Welcome back. Every day counts." bestLabel="Best 7" />);
    expect(screen.getByLabelText('3 day streak. Welcome back. Every day counts.. Best 7')).toBeTruthy();
  });

  it('WeekStrip announces its summary and renders every day', async () => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => ({ key: String(i), label, state: (i < 3 ? 'done' : i === 3 ? 'today' : i === 4 ? 'missed' : 'upcoming') as 'done' | 'today' | 'missed' | 'upcoming' }));
    await wrap(<WeekStrip days={days} a11yLabel="3 of 7 days complete" />);
    expect(screen.getByLabelText('3 of 7 days complete')).toBeTruthy();
  });

  it('MilestoneBadge states earned or not earned in its label', async () => {
    await wrap(<><MilestoneBadge title="First ritual" description="Complete one ritual" earned /><MilestoneBadge title="Seven days" description="Seven days in a row" earned={false} /></>);
    expect(screen.getByLabelText('First ritual. Complete one ritual. Earned')).toBeTruthy();
    expect(screen.getByLabelText('Seven days. Seven days in a row. Not yet earned')).toBeTruthy();
  });

  it('ListRow is a button only when pressable', async () => {
    const onPress = jest.fn();
    await wrap(<><ListRow title="Reminders" subtitle="Morning, 7:00" onPress={onPress} /><ListRow title="Version" subtitle="1.0.0" /></>);
    fireEvent.press(screen.getByRole('button', { name: 'Reminders. Morning, 7:00' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('Chip reports selected state', async () => {
    const onPress = jest.fn();
    await wrap(<Chip label="Mon" selected onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Mon' });
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
  });

  it('every icon renders hidden from accessibility', async () => {
    const names: IconName[] = ['home', 'book', 'prayer', 'journey', 'profile', 'check', 'flame', 'lock', 'chevron', 'star'];
    await wrap(<>{names.map((n) => <Icon key={n} name={n} />)}</>);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
