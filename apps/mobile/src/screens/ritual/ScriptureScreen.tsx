import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Heading, ScriptureText } from '../../components';
import { loadDailyRitual } from '../../features/ritual/loadDaily';
import { useRitual, useServices } from '../../serviceContext';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

export function ScriptureScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Scripture'>) {
  const { t } = useTranslation();
  const s = useServices();
  const ritual = useRitual();
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => loadDailyRitual(s.api, s.cache, s.kv, s.localToday) });
  const v = daily.data?.today.verse;
  return (
    <Screen>
      <Heading>{t('scripture.title')}</Heading>
      {v ? <ScriptureText text={v.text} reference={`${v.reference.book} ${v.reference.chapter}:${v.reference.verse_start}${v.reference.verse_end ? `-${v.reference.verse_end}` : ''}`} attribution={`${t('scripture.attribution')}: ${v.translation.attribution_text}`} /> : null}
      <Button label={t('scripture.finish')} disabled={!v} onPress={() => { if (ritual.completeScripture()) navigation.replace('Prayer'); }} />
    </Screen>
  );
}
