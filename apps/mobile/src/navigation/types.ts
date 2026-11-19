export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Translation: undefined;
  FirstRitualTaste: undefined;
  AppSelection: undefined;
  ScheduleSetup: undefined;
  Account: { afterFirstRitual?: boolean } | undefined;
  Main: undefined;
  Scripture: undefined;
  Prayer: undefined;
  Timer: undefined;
  Completion: undefined;
  Schedules: undefined;
  Reader: undefined;
  PathDetails: { pathId: string; title: string };
  Lesson: { lessonId: string; title: string };
  Quiz: { lessonId: string };
  Tutor: undefined;
  Paywall: { source: 'learning' | 'tutor' | 'settings' | 'post_lesson' };
  Capability: undefined;
  Privacy: undefined;
  DemoShield: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Habits: undefined;
  Learn: undefined;
  Settings: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
