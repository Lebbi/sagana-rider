// utils/secureStorage.ts
// Unified secure storage wrapper. Tries expo-secure-store first (encrypted,
// backed by Keychain on iOS and EncryptedSharedPreferences on Android). If
// the native module isn't available (e.g. running in Expo Go, web, or tests)
// it falls back to AsyncStorage.
//
// All `auth_token` writes/reads in the app should go through this module
// rather than calling AsyncStorage directly. This keeps a single migration
// point when we fully move to SecureStore in a future SDK.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Detect SecureStore availability once at module load
let secureStoreAvailable: boolean | null = null;
async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  try {
    // SecureStore throws on web/Expo Go where the native module isn't loaded
    await SecureStore.getItemAsync("__sagana_probe__");
    secureStoreAvailable = true;
  } catch {
    secureStoreAvailable = false;
  }
  return secureStoreAvailable;
}

const PREFIX = "sagana_secure:";

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (await isSecureStoreAvailable()) {
        return await SecureStore.getItemAsync(key);
      }
    } catch {}
    return AsyncStorage.getItem(PREFIX + key);
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(key, value);
        // Do NOT mirror to AsyncStorage — tokens must stay in SecureStore only.
        // (D2 finding 5: the old mirror defeated the purpose of SecureStore.)
        return;
      }
    } catch {}
    // SecureStore unavailable (Expo Go / web) — AsyncStorage fallback only.
    // On a standalone APK, SecureStore is always available, so this path
    // is dev-only and never runs in production.
    await AsyncStorage.setItem(PREFIX + key, value);
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch {}
    await AsyncStorage.removeItem(PREFIX + key);
  },

  /**
   * Migrate an existing AsyncStorage value into SecureStore, then remove the
   * legacy copy. Safe to call on every app boot — no-op if already migrated.
   */
  async migrateFromAsyncStorage(key: string): Promise<void> {
    if (!(await isSecureStoreAvailable())) return;
    try {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy && (await SecureStore.getItemAsync(key)) !== legacy) {
        await SecureStore.setItemAsync(key, legacy);
        await AsyncStorage.removeItem(key);
      }
    } catch {}
  },
};

export default secureStorage;
