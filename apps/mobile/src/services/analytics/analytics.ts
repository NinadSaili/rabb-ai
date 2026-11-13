import { validateEvent, type AnalyticsEventName, type AnalyticsProps } from './allowlist';

export interface AnalyticsSink {
  capture(event: string, properties: Record<string, string | number | boolean>): void;
}

/**
 * PostHog wrapper. Autocapture and session replay are disabled where the SDK is created (see posthogSink).
 * Only allow listed events with allow listed properties are forwarded. Anything else is dropped,
 * and throws under test so a bad call site fails the build.
 */
export class Analytics {
  readonly rejected: string[] = [];
  constructor(private sink: AnalyticsSink | null, private readonly strict = false) {}

  setSink(sink: AnalyticsSink | null): void {
    this.sink = sink;
  }

  track<E extends AnalyticsEventName>(event: E, props?: AnalyticsProps<E>): boolean {
    const result = validateEvent(event, props as Record<string, unknown> | undefined);
    if (!result.ok) {
      this.rejected.push(result.reason);
      if (this.strict) throw new Error(`analytics rejected: ${result.reason}`);
      return false;
    }
    this.sink?.capture(event, result.props);
    return true;
  }
}

export const analytics = new Analytics(null, typeof jest !== 'undefined');
