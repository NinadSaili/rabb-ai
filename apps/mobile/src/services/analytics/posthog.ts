import PostHog from 'posthog-react-native';
import type { AnalyticsSink } from './analytics';

export function createPostHogSink(apiKey: string, host: string): AnalyticsSink {
  const client = new PostHog(apiKey, {
    host,
    captureAppLifecycleEvents: false,
    enableSessionReplay: false,
    disableGeoip: true,
    // No autocapture of touches or screens.
    autocapture: false as never,
  });
  return { capture: (event, properties) => client.capture(event, properties) };
}
