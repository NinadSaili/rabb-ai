import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { AppText, Button, Card, ErrorState, Heading, Skeleton } from '../../components';
import { config } from '../../config';
import { analytics } from '../../services/analytics/analytics';
import { useServices } from '../../serviceContext';
import type { RootStackParamList } from '../../navigation/types';
import { Screen } from '../Screen';

let configured = false;
export function configurePurchases(appUserId: string): void {
  if (configured) return;
  const apiKey = Platform.OS === 'ios' ? config.revenueCatIos : config.revenueCatAndroid;
  if (!apiKey) return;
  // appUserID is the Supabase user id, so the webhook can attach the entitlement to the right row.
  Purchases.configure({ apiKey, appUserID: appUserId });
  configured = true;
}

/**
 * Paywall. Offerings come from RevenueCat at runtime (no prices in code). After any purchase or restore the app re-reads
 * the entitlement from the server, which is written only by the RevenueCat webhook. There is no local premium flag.
 */
export function PaywallScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Paywall'>) {
  const { t } = useTranslation();
  const { supabase } = useServices();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    analytics.track('premium_paywall_viewed', { source: route.params.source });
  }, [route.params.source]);

  const offerings = useQuery({
    queryKey: ['offerings'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) configurePurchases(data.session.user.id);
      const o = await Purchases.getOfferings();
      return o.current?.availablePackages ?? [];
    },
  });

  const refreshEntitlement = async () => {
    // Webhook delivery can lag a few seconds. Poll the server briefly instead of trusting the SDK's local answer.
    for (let i = 0; i < 5; i++) {
      await qc.invalidateQueries({ queryKey: ['subscription'] });
      const status = qc.getQueryData<boolean>(['subscription']);
      if (status) return true;
      await new Promise<void>((r) => setTimeout(() => r(), 1500));
    }
    return false;
  };

  const buy = async (pkg: PurchasesPackage) => {
    setBusy(true);
    try {
      await Purchases.purchasePackage(pkg);
      analytics.track('subscription_started', { period: pkg.packageType === 'ANNUAL' ? 'annual' : 'monthly', is_trial: !!pkg.product.introPrice });
      if (await refreshEntitlement()) navigation.goBack();
      else setMessage(t('errors.generic'));
    } catch {
      setMessage(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await Purchases.restorePurchases();
      if (await refreshEntitlement()) navigation.goBack();
    } catch {
      setMessage(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Heading>{t('paywall.title')}</Heading>
      <AppText>{t('paywall.features')}</AppText>
      {offerings.isLoading ? <Skeleton height={96} /> : null}
      {offerings.isError || offerings.data?.length === 0 ? <ErrorState message={t('paywall.unavailable')} retryLabel={t('common.retry')} onRetry={() => void offerings.refetch()} /> : null}
      {offerings.data?.map((pkg) => {
        const period = pkg.packageType === 'ANNUAL' ? t('paywall.annual') : t('paywall.monthly');
        const price = pkg.product.priceString;
        const intro = pkg.product.introPrice;
        return (
          <Card key={pkg.identifier} label={`${price} ${period}`}>
            <AppText weight="semibold">{t('paywall.price', { price, period })}</AppText>
            {intro ? <AppText muted size={13}>{t('paywall.trial', { trial: `${intro.periodNumberOfUnits} ${intro.periodUnit.toLowerCase()}`, price, period })}</AppText> : null}
            <Button label={t('paywall.subscribe')} loading={busy} onPress={() => void buy(pkg)} />
          </Card>
        );
      })}
      <AppText muted size={13}>{t('paywall.renewal')}</AppText>
      {message ? <AppText accessibilityLiveRegion="polite">{message}</AppText> : null}
      <Button label={t('paywall.restore')} variant="secondary" onPress={() => void restore()} />
      <Button label={t('paywall.terms')} variant="secondary" onPress={() => void Linking.openURL(config.termsUrl)} />
      <Button label={t('paywall.privacy')} variant="secondary" onPress={() => void Linking.openURL(config.privacyUrl)} />
    </Screen>
  );
}
