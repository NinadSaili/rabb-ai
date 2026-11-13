/**
 * Native app blocking contract, implemented in Swift (iOS) and Kotlin (Android) as an Expo module.
 * Rules (AGENTS.md): restriction state is always read back from the native layer. Nothing here may be inferred
 * from an API response or a local flag. Selected application identities never leave the device.
 */
export type Platform = 'ios' | 'android';
export type CapabilityTier = 'tier0' | 'tier1' | 'tier2';

export type PermissionKind = 'family_controls' | 'usage_access' | 'overlay' | 'notifications' | 'battery_optimization';
export type PermissionState = 'granted' | 'denied' | 'not_determined' | 'revoked' | 'unavailable';

export type NativeFailure =
  | 'entitlement_missing'
  | 'authorization_denied'
  | 'authorization_revoked'
  | 'picker_cancelled'
  | 'extension_unresponsive'
  | 'permission_missing'
  | 'service_not_running'
  | 'native_module_unavailable'
  | 'native_error';

export interface Capabilities {
  platform: Platform;
  tier: CapabilityTier;
  /** Plain language list of what is not enforced on this device right now. Shown on the status screen. */
  unmet: { requirement: PermissionKind | 'service' | 'entitlement' | 'flag'; message: string }[];
  /** Always false for guarantees. Enforcement is best effort, especially on Android. */
  guaranteed: false;
}

export interface SelectionSummary {
  count: number;
  categoryCount: number;
  webDomainCount: number;
}

/** iOS returns counts only (tokens are opaque). Android may include labels, which stay on device. */
export interface SelectedApplicationsInfo extends SelectionSummary {
  names?: string[];
}

export interface NativeStatus {
  /** True only when the OS layer reports the restriction is applied right now. The only source for "locked". */
  restrictionApplied: boolean;
  tier: CapabilityTier;
  /** Epoch ms of the last heartbeat from the monitor extension or service, when available. */
  lastHeartbeatMs: number | null;
  failure: NativeFailure | null;
}

export interface RestrictionWindow {
  scheduleId: string;
  /** Epoch ms. The native layer registers these with DeviceActivity (iOS) or the service watchdog (Android). */
  startMs: number;
  endMs: number;
}

export interface AppBlockingService {
  getCapabilities(): Promise<Capabilities>;
  getPermissionState(kind: PermissionKind): Promise<PermissionState>;
  requestPermission(kind: PermissionKind): Promise<PermissionState>;
  presentAppPicker(): Promise<{ result: 'selected' | 'cancelled'; summary: SelectionSummary } | { result: 'failed'; failure: NativeFailure }>;
  getSelectedApplicationDisplayNames(): Promise<SelectedApplicationsInfo>;
  applyRestrictions(): Promise<NativeStatus>;
  /** Removes restrictions locally. Independent of backend sync. */
  removeRestrictions(): Promise<NativeStatus>;
  /** Registers future windows so the OS layer re-applies restrictions at window starts. */
  scheduleRestrictions(windows: RestrictionWindow[]): Promise<void>;
  /** Always a fresh read from the native layer. */
  getRestrictionStatus(): Promise<NativeStatus>;
  /** Suspends restrictions until the given epoch ms (emergency bypass and post ritual unlock). */
  suspendUntil(untilMs: number): Promise<NativeStatus>;
  /** Remote feature flags (Supabase feature_flags). Android Tier 1 and Tier 2 default off. */
  setFeatureFlags?(flags: { tier1: boolean; accessibility: boolean }): Promise<void>;
}
