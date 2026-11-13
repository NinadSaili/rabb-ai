import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.md, gap: spacing.md };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: palette.background }, pad]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}
