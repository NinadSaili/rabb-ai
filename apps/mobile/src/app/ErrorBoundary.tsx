import React from 'react';
import { i18n } from '../i18n';
import { reportError } from '../services/sentry/init';
import { ErrorState } from '../components';

/** Catches render errors. The report goes through Sentry scrubbing and carries no screen content. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportError(error);
  }
  render() {
    if (this.state.failed) {
      return <ErrorState message={i18n.t('errors.boundary')} retryLabel={i18n.t('common.retry')} onRetry={() => this.setState({ failed: false })} />;
    }
    return this.props.children;
  }
}
