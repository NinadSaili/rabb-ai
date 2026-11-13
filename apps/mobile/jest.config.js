module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|@rabb|react-native-mmkv|@notifee|@sentry|posthog-react-native|react-native-purchases)/)',
  ],
};
