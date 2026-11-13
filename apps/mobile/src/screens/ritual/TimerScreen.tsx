import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Heading, Timer } from '../../components';
import { useRitual } from '../../serviceContext';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

/** The timer uses a monotonic clock (performance.now). Changing the device clock cannot shorten it. */
export function TimerScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Timer'>) {
  const { t } = useTranslation();
  const ritual = useRitual();
  const total = ritual.state.timerSeconds ?? 0;
  const [started, setStarted] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(id);
  }, [started]);
  const remaining = Math.max(0, total - ritual.elapsedTimerMs() / 1000);
  const finished = started && remaining <= 0;
  return (
    <Screen>
      <Heading>{t('timer.title')}</Heading>
      <Timer t={t as never} remainingSeconds={started ? remaining : total} />
      {!started ? <Button label={t('timer.start')} onPress={() => { ritual.startTimer(); setStarted(true); }} /> : null}
      <Button
        label={t('timer.finish')}
        disabled={!finished}
        onPress={() => {
          if (ritual.completeTimer() && ritual.finish()) navigation.replace('Completion');
        }}
      />
      {started && !finished ? <AppText muted>{t('timer.tooEarly')}</AppText> : null}
    </Screen>
  );
}
