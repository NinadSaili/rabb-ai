import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Heading, PrayerText } from '../../components';
import { loadDailyRitual } from '../../features/ritual/loadDaily';
import { useRitual, useServices } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

/** Prayers are editorial, reviewed and approved. They are never presented as scripture. */
export function PrayerScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Prayer'>) {
  const { t } = useTranslation();
  const s = useServices();
  const ritual = useRitual();
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => loadDailyRitual(s.api, s.cache, s.kv, s.localToday) });
  const p = daily.data?.today.prayer;
  return (
    <Screen>
      <Heading>{t('prayer.title')}</Heading>
      {p ? <PrayerText title={p.title} body={p.body} /> : null}
      <AppText muted size={13}>{t('prayer.editorialNote')}</AppText>
      <Button
        label={t('prayer.finish')}
        disabled={!p}
        onPress={() => {
          if (!ritual.completePrayer()) return;
          if (ritual.state.timerSeconds !== null) navigation.replace('Timer');
          else if (ritual.finish()) navigation.replace('Completion');
        }}
      />
    </Screen>
  );
}
