/** Public client configuration, inlined at build time from .env. Contains no secrets. */
export const config = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  revenueCatIos: process.env.REVENUECAT_IOS_PUBLIC_KEY ?? '',
  revenueCatAndroid: process.env.REVENUECAT_ANDROID_PUBLIC_KEY ?? '',
  sentryDsn: process.env.SENTRY_DSN || undefined,
  posthogKey: process.env.POSTHOG_API_KEY ?? '',
  posthogHost: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
  termsUrl: 'https://rabb.ai/terms',
  privacyUrl: 'https://rabb.ai/privacy',
  supportUrl: 'https://rabb.ai/support',
} as const;

/**
 * Product surface flags. The MVP is the free daily core only. Learning paths, the AI tutor and the paywall stay in
 * the codebase (and keep their tests) but are not reachable until this is turned on in a later release.
 */
export const features = { premiumUi: false } as const;

export function functionsBaseUrl(): string {
  return `${config.supabaseUrl}/functions/v1/v1`;
}
