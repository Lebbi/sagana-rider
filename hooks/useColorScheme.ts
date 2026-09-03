import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

export type ColorSchemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "color_scheme_preference";

/**
 * Custom useColorScheme hook that:
 * 1. Reads a manual override from AsyncStorage (set by the user via the dark mode toggle)
 * 2. Falls back to the system color scheme
 * 3. Persists across app restarts
 *
 * Returns 'light' or 'dark' (never null).
 */
export function useColorScheme(): "light" | "dark" {
  const systemColorScheme = useRNColorScheme();
  const [preference, setPreference] = useState<ColorSchemePreference>("system");
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load preference from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreference(stored);
      }
      setHasHydrated(true);
    });
  }, []);

  // Listen for preference changes from other components (e.g. the toggle)
  useEffect(() => {
    const checkUpdate = () => {
      AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreference(stored);
        }
      });
    };
    // Check on focus (when returning from settings)
    const interval = setInterval(checkUpdate, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!hasHydrated) return "light";

  if (preference === "system") {
    return systemColorScheme === "dark" ? "dark" : "light";
  }

  return preference;
}

/**
 * Set the color scheme preference (persisted to AsyncStorage).
 * Call this from the dark mode toggle in FarmerAccountProfile.
 * Pass 'system' to follow the device setting, 'dark' or 'light' to override.
 */
export async function setColorSchemePreference(
  pref: ColorSchemePreference,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, pref);
}

/**
 * Get the current stored preference without React (for initial load).
 */
export async function getColorSchemePreference(): Promise<ColorSchemePreference> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}
