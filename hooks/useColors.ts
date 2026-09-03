import { darkColors, lightColors } from "@/constants/ColorTheme";
import { useColorScheme } from "@/hooks/useColorScheme";

/**
 * `useColors` - returns the active color palette (light or dark)
 * based on the device's current color scheme.
 *
 * Use this in components instead of importing `lightColors` directly,
 * so dark mode support works automatically:
 *
 *   const colors = useColors();
 *   <View style={{ backgroundColor: colors.surface }} />
 */
export function useColors() {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}
