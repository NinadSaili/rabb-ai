import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppText } from '../components';
import { useServices } from '../serviceContext';
import { spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/** Shown on every screen in DEMO MODE so nobody mistakes the simulation for real enforcement. */
export function DemoBanner() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  return (
    <View accessible accessibilityRole="alert" accessibilityLabel={t('demo.banner')} style={{ borderWidth: 2, borderColor: palette.warning, borderRadius: 8, padding: spacing.sm }}>
      <AppText size={13} weight="semibold">{t('demo.banner')}</AppText>
    </View>
  );
}

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { demo } = useServices();
  const pad = { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.md, gap: spacing.md };
  const body = (<>{demo ? <DemoBanner /> : null}{children}</>);
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: palette.background }, pad]}>{body}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
      {body}
    </ScrollView>
  );
}
