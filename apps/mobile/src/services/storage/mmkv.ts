import { createMMKV } from 'react-native-mmkv';
import type { KeyValueStore } from './kv';

/** MMKV backed cache for non sensitive data only. */
export function createMmkvStore(id = 'rabb-cache'): KeyValueStore {
  const mmkv = createMMKV({ id });
  return {
    getString: (k) => mmkv.getString(k),
    set: (k, v) => mmkv.set(k, v),
    delete: (k) => {
      mmkv.remove(k);
    },
    keys: () => mmkv.getAllKeys(),
  };
}
