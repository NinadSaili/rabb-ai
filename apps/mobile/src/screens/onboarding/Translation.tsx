import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { AppText, Button, Card, ErrorState, Heading, Skeleton } from '../../components';
import { useServices } from '../../services';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

/** Lists translations the server may serve (RLS: any authenticated user can read translation metadata). DEV ONLY rows are labelled. */
export function useTranslations() {
  const { supabase } = useServices();
  return useQuery({
    queryKey: ['translations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('scripture_translations').select('code,name,language,license_name,attribution_text,is_dev_only').order('code');
      if (error) throw error;
      return data as { code: string; name: string; language: string; license_name: string; attribution_text: string; is_dev_only: boolean }[];
    },
  });
}

export function TranslationScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Translation'>) {
  const { t } = useTranslation();
  const { settings } = useServices();
  const q = useTranslations();
  const selected = settings((s) => s.translationCode);
  return (
    <Screen>
      <Heading>{t('onboarding.translationTitle')}</Heading>
      <AppText muted>{t('onboarding.translationBody')}</AppText>
      {q.isLoading ? <Skeleton height={64} /> : null}
      {q.isError ? <ErrorState message={t('errors.generic')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {q.data?.map((tr) => (
        <Pressable key={tr.code} accessibilityRole="radio" accessibilityState={{ selected: selected === tr.code }} accessibilityLabel={`${tr.name}${tr.is_dev_only ? ', development fixture' : ''}`} onPress={() => settings.getState().update({ translationCode: tr.code })}>
          <Card>
            <AppText weight="semibold">{selected === tr.code ? '● ' : '○ '}{tr.name}</AppText>
            <AppText muted size={13}>{tr.attribution_text}</AppText>
            {tr.is_dev_only ? <AppText size={13}>DEV ONLY, unlicensed fixture</AppText> : null}
          </Card>
        </Pressable>
      ))}
      <Button label={t('common.continue')} onPress={() => navigation.navigate('FirstRitualTaste')} />
    </Screen>
  );
}
