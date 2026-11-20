import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { features } from '../config';
import { Icon } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { PrayTabScreen } from '../screens/PrayTabScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { DemoShieldScreen } from '../screens/DemoShieldScreen';
import { CapabilityScreen } from '../screens/CapabilityScreen';
import { HabitsScreen } from '../screens/HabitsScreen';
import { LearningHomeScreen, LessonScreen, PathDetailsScreen, QuizScreen } from '../screens/learning/Learning';
import { PaywallScreen } from '../screens/learning/Paywall';
import { TutorScreen } from '../screens/learning/Tutor';
import { AppSelectionScreen } from '../screens/onboarding/AppSelection';
import { FirstRitualTasteScreen } from '../screens/onboarding/FirstRitualTaste';
import { ScheduleSetupScreen } from '../screens/onboarding/ScheduleSetup';
import { TranslationScreen } from '../screens/onboarding/Translation';
import { WelcomeScreen } from '../screens/onboarding/Welcome';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { ReaderScreen } from '../screens/ReaderScreen';
import { CompletionScreen } from '../screens/ritual/CompletionScreen';
import { PrayerScreen } from '../screens/ritual/PrayerScreen';
import { RitualHomeScreen } from '../screens/ritual/RitualHome';
import { ScriptureScreen } from '../screens/ritual/ScriptureScreen';
import { TimerScreen } from '../screens/ritual/TimerScreen';
import { SchedulesScreen } from '../screens/SchedulesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { fonts } from '../theme/tokens';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accentText,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border, minHeight: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.uiMedium, fontSize: 12 },
        tabBarAllowFontScaling: true,
      }}
    >
      <Tabs.Screen name="Home" component={RitualHomeScreen} options={{ title: t('tabs.home'), tabBarIcon: ({ color }) => <Icon name="home" color={color} /> }} />
      <Tabs.Screen name="Read" component={ReaderScreen} options={{ title: t('tabs.read'), tabBarIcon: ({ color }) => <Icon name="book" color={color} /> }} />
      <Tabs.Screen name="Pray" component={PrayTabScreen} options={{ title: t('tabs.pray'), tabBarIcon: ({ color }) => <Icon name="prayer" color={color} /> }} />
      <Tabs.Screen name="Journey" component={HabitsScreen} options={{ title: t('tabs.journey'), tabBarIcon: ({ color }) => <Icon name="journey" color={color} /> }} />
      <Tabs.Screen name="Profile" component={SettingsScreen as never} options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <Icon name="profile" color={color} /> }} />
      {features.premiumUi ? <Tabs.Screen name="Learn" component={LearningHomeScreen as never} options={{ title: t('learning.title') }} /> : null}
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Translation" component={TranslationScreen} />
      <Stack.Screen name="FirstRitualTaste" component={FirstRitualTasteScreen} />
      <Stack.Screen name="AppSelection" component={AppSelectionScreen} />
      <Stack.Screen name="ScheduleSetup" component={ScheduleSetupScreen} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Scripture" component={ScriptureScreen} />
      <Stack.Screen name="Prayer" component={PrayerScreen} />
      <Stack.Screen name="Timer" component={TimerScreen} />
      <Stack.Screen name="Completion" component={CompletionScreen} />
      <Stack.Screen name="Schedules" component={SchedulesScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Reader" component={ReaderScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="PathDetails" component={PathDetailsScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Lesson" component={LessonScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Quiz" component={QuizScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Tutor" component={TutorScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Capability" component={CapabilityScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="DemoShield" component={DemoShieldScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: true, title: '' }} />
    </Stack.Navigator>
  );
}
