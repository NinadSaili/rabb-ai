import { requireNativeModule } from 'expo-modules-core';
import type { AppBlockingService } from '../../src/services/blocking/types';

/**
 * JS face of the native module (Swift on iOS, Kotlin on Android). Every method returns state read from the OS layer.
 * Written against the Expo Modules API. Not compiled or exercised on a device in the authoring environment (BLOCKED, see docs/STATUS.md).
 */
const native = requireNativeModule('RabbBlocking');

const service: AppBlockingService & { setFeatureFlags(flags: { tier1: boolean; accessibility: boolean }): Promise<void> } = {
  getCapabilities: () => native.getCapabilities(),
  getPermissionState: (kind) => native.getPermissionState(kind),
  requestPermission: (kind) => native.requestPermission(kind),
  presentAppPicker: () => native.presentAppPicker(),
  getSelectedApplicationDisplayNames: () => native.getSelectedApplicationDisplayNames(),
  applyRestrictions: () => native.applyRestrictions(),
  removeRestrictions: () => native.removeRestrictions(),
  scheduleRestrictions: (windows) => native.scheduleRestrictions(windows),
  getRestrictionStatus: () => native.getRestrictionStatus(),
  suspendUntil: (untilMs) => native.suspendUntil(untilMs),
  disableBlocking: () => native.disableBlocking(),
  setFeatureFlags: (flags) => native.setFeatureFlags(flags),
};

export default service;
