require('dotenv').config({ path: '.env' });
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Inlines the PUBLIC client values from .env at build time. Server secrets never belong in this file (see .env.example).
  plugins: [['transform-inline-environment-variables', { include: ['DEMO_MODE', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'REVENUECAT_IOS_PUBLIC_KEY', 'REVENUECAT_ANDROID_PUBLIC_KEY', 'SENTRY_DSN', 'POSTHOG_API_KEY', 'POSTHOG_HOST', 'GOOGLE_WEB_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID'] }]],
};
