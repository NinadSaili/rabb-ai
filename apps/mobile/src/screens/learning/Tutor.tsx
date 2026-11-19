import { tutorResponse, type TutorResponse } from '@rabb/contracts';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from 'react-native';
import { AppText, Button, Card, Heading, ScriptureText } from '../../components';
import { ApiError } from '../../services/api/client';
import { useServices } from '../../serviceContext';
import { useTheme } from '../../theme/ThemeProvider';
import { Screen } from '../Screen';

/**
 * Tutor. Scripture blocks (server verified, exact stored text) and commentary blocks are visually separate.
 * Questions are never logged or sent to analytics. Fixed messages (crisis, declined, nothing found) come from the server.
 */
export function TutorScreen() {
  const { t } = useTranslation();
  const { api } = useServices();
  const { palette } = useTheme();
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<TutorResponse | null>(null);
  const [thread, setThread] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/v1/ai/tutor', { message, ...(thread ? { thread_id: thread } : {}) }, tutorResponse);
      setAnswer(r);
      setThread(r.thread_id);
      setMessage('');
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'quota_exceeded' ? t('errors.generic') : t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading>{t('tutor.title')}</Heading>
      <AppText muted size={13}>{t('tutor.disclaimer')}</AppText>
      <TextInput accessibilityLabel={t('tutor.placeholder')} placeholder={t('tutor.placeholder')} placeholderTextColor={palette.textMuted} multiline maxLength={2000} value={message} onChangeText={setMessage} style={{ borderWidth: 1, borderColor: palette.border, color: palette.text, borderRadius: 8, padding: 12, minHeight: 96 }} />
      <Button label={t('tutor.send')} loading={busy} disabled={message.trim().length === 0} onPress={() => void ask()} />
      {error ? <AppText accessibilityLiveRegion="polite">{error}</AppText> : null}
      {answer?.fixed_message ? <Card><AppText accessibilityLiveRegion="polite">{answer.fixed_message}</AppText></Card> : null}
      {answer?.blocks.map((b, i) =>
        b.type === 'scripture' ? (
          <Card key={i} label={t('tutor.scripture')}>
            <AppText muted size={12}>{t('tutor.scripture')}</AppText>
            <ScriptureText text={b.text} reference={`${b.reference.book} ${b.reference.chapter}:${b.reference.verse_start}${b.reference.verse_end ? `-${b.reference.verse_end}` : ''} (${b.translation})`} />
          </Card>
        ) : (
          <Card key={i} label={t('tutor.commentary')}>
            <AppText muted size={12}>{b.label === 'interpretation' ? t('tutor.interpretation') : t('tutor.commentary')}</AppText>
            <AppText>{b.text}</AppText>
            {b.references.map((r) => <AppText key={`${r.book}${r.chapter}${r.verse_start}`} muted size={13}>{r.book} {r.chapter}:{r.verse_start}</AppText>)}
          </Card>
        ),
      )}
    </Screen>
  );
}
