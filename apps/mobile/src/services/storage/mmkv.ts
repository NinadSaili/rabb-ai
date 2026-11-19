import { MMKV } from 'react-native-mmkv';
import type { KeyValueStore } from './kv';

/** MMKV backed cache for non sensitive data only. Tokens use the Keychain and Keystore adapter (secure.ts). */
export function createMmkvStore(id = 'rabb-cache'): KeyValueStore {
  const mmkv = new MMKV({ id });
  return {
    getString: (k) => mmkv.getString(k),
    set: (k, v) => mmkv.set(k, v),
    delete: (k) => mmkv.delete(k),
    keys: () => mmkv.getAllKeys(),
  };
}
