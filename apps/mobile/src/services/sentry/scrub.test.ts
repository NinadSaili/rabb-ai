import { scrubBreadcrumb, scrubEvent } from './scrub';

describe('Sentry scrubbing', () => {
  const event = {
    user: { id: 'anon-123', email: 'a@b.c', ip_address: '1.2.3.4' },
    request: { url: 'https://x.test/v1/ai/tutor?q=secret', data: '{"message":"my private question"}', headers: { authorization: 'Bearer abc' } },
    message: 'failed for com.instagram.android while loading',
    extra: { journalBody: 'private text', prayer_text: 'Dear Lord', selectedPackages: ['com.tiktok.app'], counts: 3, nested: { token: 'abc', note: 'ok' } },
    tags: { screen: 'home', email: 'a@b.c' },
    contexts: { app: { app_name: 'Rabb.ai' } },
    exception: { values: [{ type: 'Error', value: 'Cannot read com.whatsapp.android state' }] },
    breadcrumbs: [
      { category: 'xhr', data: { url: '/v1/ai/tutor', body: 'secret' } },
      { category: 'console', message: 'opened com.spotify.music', data: { journal: 'x', level: 'info' } },
      { category: 'ui.input', message: 'typing' },
    ],
  };
  const out = scrubEvent(event);

  it('removes user identity and request details', () => {
    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
  });
  it('redacts journal, prayer, message and token keys at any depth', () => {
    expect(out.extra).toEqual({ journalBody: '[redacted]', prayer_text: '[redacted]', selectedPackages: '[redacted]', counts: 3, nested: { token: '[redacted]', note: 'ok' } });
    expect(out.tags).toEqual({ screen: 'home', email: '[redacted]' });
  });
  it('masks package-name-like strings in messages and exceptions', () => {
    expect(out.message).toBe('failed for [package] while loading');
    expect(out.exception?.values?.[0]?.value).toBe('Cannot read [package] state');
  });
  it('drops network and input breadcrumbs and scrubs the rest', () => {
    expect(out.breadcrumbs).toHaveLength(1);
    expect(out.breadcrumbs?.[0]).toEqual({ category: 'console', message: 'opened [package]', data: { journal: '[redacted]', level: 'info' } });
    expect(scrubBreadcrumb({ category: 'fetch' })).toBeNull();
  });
  it('serialised output contains none of the sensitive strings', () => {
    const s = JSON.stringify(out);
    for (const bad of ['private', 'Dear Lord', 'com.instagram', 'com.tiktok', 'a@b.c', 'Bearer', 'secret', 'com.spotify']) expect(s).not.toContain(bad);
  });
});
