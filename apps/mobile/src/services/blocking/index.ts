import { Platform } from 'react-native';
import type { AppBlockingService } from './types';
import { UnavailableBlockingService } from './unavailable';

/**
 * Resolves the native module (apps/mobile/modules/rabb-blocking, an Expo module written in Swift and Kotlin).
 * When it is missing the app runs at Tier 0 and says so.
 */
export function createBlockingService(): AppBlockingService {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../modules/rabb-blocking') as { default?: AppBlockingService } | undefined;
    if (mod?.default) return mod.default;
  } catch {
    // Native module not linked in this build.
  }
  return new UnavailableBlockingService(platform);
}

export * from './types';
export { UnavailableBlockingService } from './unavailable';
