import type { AppBlockingService, Capabilities, NativeStatus, PermissionKind, PermissionState } from './types';

/**
 * Used when the native module is not present (simulator without entitlement, Jest, unsupported OS).
 * It is not a pretend blocker: it reports Tier 0 and never claims a restriction is applied.
 */
export class UnavailableBlockingService implements AppBlockingService {
  constructor(private readonly platform: 'ios' | 'android' = 'android') {}

  private status(): NativeStatus {
    return { restrictionApplied: false, tier: 'tier0', lastHeartbeatMs: null, failure: 'native_module_unavailable' };
  }
  getCapabilities(): Promise<Capabilities> {
    return Promise.resolve({
      platform: this.platform,
      tier: 'tier0',
      unmet: [{ requirement: 'service', message: 'App blocking is not available on this device. Rabb.ai can remind you but cannot restrict apps.' }],
      guaranteed: false,
    });
  }
  getPermissionState(_kind: PermissionKind): Promise<PermissionState> {
    return Promise.resolve('unavailable');
  }
  requestPermission(_kind: PermissionKind): Promise<PermissionState> {
    return Promise.resolve('unavailable');
  }
  presentAppPicker() {
    return Promise.resolve({ result: 'failed' as const, failure: 'native_module_unavailable' as const });
  }
  getSelectedApplicationDisplayNames() {
    return Promise.resolve({ count: 0, categoryCount: 0, webDomainCount: 0 });
  }
  applyRestrictions() {
    return Promise.resolve(this.status());
  }
  removeRestrictions() {
    return Promise.resolve(this.status());
  }
  scheduleRestrictions() {
    return Promise.resolve();
  }
  getRestrictionStatus() {
    return Promise.resolve(this.status());
  }
  disableBlocking() {
    return Promise.resolve(this.status());
  }
  suspendUntil() {
    return Promise.resolve(this.status());
  }
}
