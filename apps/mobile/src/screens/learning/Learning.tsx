import { answerResponse, quizResponse } from '@rabb/contracts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, EmptyState, ErrorState, Heading, Skeleton } from '../../components';
import { ApiError } from '../../services/api/client';
import { fetchSubscriptionStatus, hasPremium } from '../../services/api/entitlement';
import { analytics } from '../../services/analytics/analytics';
import { useServices } from '../../services';
import { uuidv4 } from '../../utils/id';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

export function usePremium() {
  const { api } = useServices();
  return useQuery({ queryKey: ['subscription'], queryFn: () => fetchSubscriptionStatus(api), select: hasPremium });
}

/** Learning home: path titles are visible to everyone. Lesson bodies are gated by RLS and the paywall is polite. */
export function LearningHomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Main'> | { navigation: { navigate: (n: keyof RootStackParamList, p?: object) => void } }) {
  const { t } = useTranslation();
  const { supabase } = useServices();
  const premium = usePremium();
  const q = useQuery({
    queryKey: ['paths'],
    queryFn: async () => {
      const { data, error } = await supabase.from('learning_paths').select('id,title,description,kind').order('position');
      if (error) throw error;
      return data as { id: string; title: string; description: string | null; kind: string }[];
    },
  });
  const go = (name: keyof RootStackParamList, params?: object) => (navigation as { navigate: (n: keyof RootStackParamList, p?: object) => void }).navigate(name, params);
  return (
    <Screen>
      <Heading>{t('learning.title')}</Heading>
      <Button label={t('tutor.title')} onPress={() => (premium.data ? go('Tutor') : go('Paywall', { source: 'tutor' }))} variant="secondary" />
      {q.isLoading ? <Skeleton height={72} /> : null}
      {q.isError ? <ErrorState message={t('errors.network')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {q.data?.length === 0 ? <EmptyState title={t('learning.paths')} /> : null}
      {q.data?.map((p) => (
        <Card key={p.id} label={p.title}>
          <AppText weight="semibold">{p.title}</AppText>
          {p.description ? <AppText muted>{p.description}</AppText> : null}
          <Button label={t('learning.lessons')} variant="secondary" onPress={() => (premium.data ? go('PathDetails', { pathId: p.id, title: p.title }) : (analytics.track('premium_paywall_viewed', { source: 'learning' }), go('Paywall', { source: 'learning' })))} />
        </Card>
      ))}
    </Screen>
  );
}

export function PathDetailsScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'PathDetails'>) {
  const { t } = useTranslation();
  const { supabase } = useServices();
  const q = useQuery({
    queryKey: ['lessons', route.params.pathId],
    queryFn: async () => {
      const { data, error } = await supabase.from('learning_lessons').select('id,title,position').eq('path_id', route.params.pathId).order('position');
      if (error) throw error;
      return data as { id: string; title: string; position: number }[];
    },
  });
  return (
    <Screen>
      <Heading>{route.params.title}</Heading>
      {q.isLoading ? <Skeleton height={56} /> : null}
      {q.isError ? <ErrorState message={t('errors.generic')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {q.data?.length === 0 ? <EmptyState title={t('learning.locked')} /> : null}
      {q.data?.map((l) => <Button key={l.id} label={`${l.position}. ${l.title}`} variant="secondary" onPress={() => navigation.navigate('Lesson', { lessonId: l.id, title: l.title })} />)}
    </Screen>
  );
}

export function LessonScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Lesson'>) {
  const { t } = useTranslation();
  const { supabase } = useServices();
  const q = useQuery({
    queryKey: ['lesson', route.params.lessonId],
    queryFn: async () => {
      const { data, error } = await supabase.from('learning_lessons').select('title,body').eq('id', route.params.lessonId).single();
      if (error) throw error;
      return data as { title: string; body: string };
    },
  });
  return (
    <Screen>
      <Heading>{route.params.title}</Heading>
      {q.isLoading ? <Skeleton height={160} /> : null}
      {q.isError ? <ErrorState message={t('errors.generic')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {q.data ? <AppText>{q.data.body}</AppText> : null}
      <Button label={t('learning.startQuiz')} disabled={!q.data} onPress={() => navigation.navigate('Quiz', { lessonId: route.params.lessonId })} />
    </Screen>
  );
}

export function QuizScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Quiz'>) {
  const { t } = useTranslation();
  const { api } = useServices();
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string | null } | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ['quiz', route.params.lessonId],
    queryFn: async () => {
      try {
        return await api.post('/v1/learning/quiz', { lesson_id: route.params.lessonId, count: 5 }, quizResponse);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'premium_required') navigation.replace('Paywall', { source: 'learning' });
        throw e;
      }
    },
    staleTime: Infinity,
  });
  const question = q.data?.questions[index];

  const answer = async (choice: number) => {
    if (!q.data || !question) return;
    const r = await api.post('/v1/learning/answer', { attempt_id: q.data.attempt_id, question_id: question.id, choice_index: choice, idempotency_key: uuidv4() }, answerResponse);
    setFeedback({ correct: r.correct, explanation: r.explanation });
    if (r.attempt_complete) {
      setScore(r.score);
      analytics.track('quiz_completed', { question_count: q.data.questions.length, score: r.score ?? 0 });
    }
  };

  return (
    <Screen>
      {q.isLoading ? <Skeleton height={120} /> : null}
      {q.isError ? <ErrorState message={t('errors.generic')} retryLabel={t('common.retry')} onRetry={() => void q.refetch()} /> : null}
      {score !== null ? <Heading>{t('learning.score', { score })}</Heading> : null}
      {question && score === null ? (
        <>
          <Heading>{question.prompt}</Heading>
          {question.choices.map((c, i) => <Button key={c} label={c} variant="secondary" disabled={feedback !== null} onPress={() => void answer(i)} />)}
          {feedback ? <AppText accessibilityLiveRegion="polite">{feedback.correct ? t('learning.correct') : t('learning.incorrect')}{feedback.explanation ? `. ${feedback.explanation}` : ''}</AppText> : null}
          {feedback ? <Button label={t('common.continue')} onPress={() => { setFeedback(null); setIndex(index + 1); }} /> : null}
        </>
      ) : null}
      {score !== null ? <Button label={t('common.done')} onPress={() => navigation.goBack()} /> : null}
    </Screen>
  );
}
