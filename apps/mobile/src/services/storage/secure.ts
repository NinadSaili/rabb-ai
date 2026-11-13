import * as Keychain from 'react-native-keychain';

/**
 * Supabase storage adapter. Auth tokens live in the iOS Keychain and Android Keystore, never in MMKV.
 * Shape matches supabase-js `auth.storage` (async getItem, setItem, removeItem).
 */
const SERVICE = 'ai.rabb.auth';

export const secureStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const r = await Keychain.getGenericPassword({ service: `${SERVICE}.${key}` });
    return r ? r.password : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await Keychain.setGenericPassword(key, value, { service: `${SERVICE}.${key}`, accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  },
  async removeItem(key: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: `${SERVICE}.${key}` });
  },
};
