import * as Sentry from '@sentry/react-native';
import { scrubBreadcrumb, scrubEvent } from './scrub';

export function initSentry(dsn: string | undefined): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableUserInteractionTracing: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event as never) as typeof event,
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb as never) as typeof breadcrumb | null,
  });
}

export function reportError(error: unknown): void {
  Sentry.captureException(error);
}
