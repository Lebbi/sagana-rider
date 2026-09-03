/**
 * ColorTheme - Unified color palette for the Sagana app.
 *
 * Provides semantic, theme-aware color tokens for both light and dark modes.
 * Components MUST import colors from this file rather than using hardcoded
 * hex values. The old `Colors` export in `Colors.ts` is kept for backwards
 * compatibility with screens that still import it directly; new code should
 * use `lightColors` / `darkColors` (or a `useColors()` hook in the future).
 */

// ---------- Brand palette (unchanged) ----------
export const saganaPalette = {
  primary: "#396B5C",
  primaryContainer: "#CEEDB2",
  secondary: "#396B5C",
  secondaryContainer: "#CEEDB2",
  tertiary: "#396B5C",
  error: "#ba1a1a",
  background: "#f5f5f5",
  surface: "#ffffff",
  surfaceVariant: "#CEEDB2",
  outline: "#6f796f",
  onPrimary: "#ffffff",
  onSecondary: "#142804",
  onBackground: "#171d17",
  onSurface: "#171d17",
  onSurfaceVariant: "#40493f",
  shadow: "#000000",
  success: "#2e7d32",
  warning: "#ef6c00",
  info: "#0277bd",
  white: "#ffffff",
  black: "#000000",
} as const;

// ---------- Light mode tokens ----------
export const lightColors = {
  // Brand
  primary: saganaPalette.primary,
  primaryContainer: saganaPalette.primaryContainer,
  secondary: saganaPalette.secondary,
  secondaryContainer: saganaPalette.secondaryContainer,
  onSecondaryContainer: "#142804",
  onPrimary: saganaPalette.onPrimary,
  onBackground: saganaPalette.onBackground,
  tertiary: saganaPalette.tertiary,

  // Backgrounds / surfaces
  background: saganaPalette.background,
  surface: saganaPalette.surface,
  surfaceVariant: saganaPalette.surfaceVariant,
  card: "#ffffff",
  backgroundWhite: "#ffffff",
  backgroundLight: "#eaf3e6",
  backgroundMuted: "#f5f5f5",
  backgroundSoft: "#f5f5f5",
  backgroundSubtle: "#fafafa",
  backgroundTint: "#D7ECC1",
  backgroundAccent: "#eef2ee",
  backgroundScaffold: "#ffffff",

  // Text
  text: saganaPalette.onSurface,
  textPrimary: saganaPalette.onSurface,
  textSecondary: "#555555",
  textMuted: "#6f796f",
  textLight: "#666666",
  textSubtle: "#999999",
  textWhite: "#ffffff",
  textDark: "#333333",

  // Borders / outlines
  border: "#e0e0e0",
  borderLight: "#f0f0f0",
  borderSoft: "#e5e7eb",
  borderInput: "#d1d5db",
  borderMuted: "#dfe6df",
  borderDivider: "#dddddd",
  borderAccent: "#c4ccc0",
  outline: saganaPalette.outline,

  // Status
  success: saganaPalette.success,
  warning: saganaPalette.warning,
  error: saganaPalette.error,
  info: saganaPalette.info,
  successContainer: "#e8f5e9",
  errorContainer: "#fff5f5",

  // Misc
  shadow: saganaPalette.shadow,
  overlay: "rgba(0,0,0,0.4)",
  overlayLight: "rgba(0,0,0,0.5)",
  scrim: "rgba(0,0,0,0.5)",
  divider: "#e0e0e0",
  disabled: "#cccccc",
  placeholder: "#999999",
  facebookBlue: "#1877F2",
  accentYellow: "#FFD700",
  accentYellowDark: "#e6c200",
  accentOrange: "#FF5722",
  transparent: "transparent",
  white: saganaPalette.white,
  black: saganaPalette.black,
} as const;

// ---------- Dark mode tokens ----------
export const darkColors = {
  // Brand
  primary: "#8ecb95",
  primaryContainer: "#2a4a3a",
  secondary: "#8ecb95",
  secondaryContainer: "#2a4a3a",
  onSecondaryContainer: "#dde5da",
  onPrimary: "#0f150f",
  onBackground: "#dde5da",
  tertiary: "#8ecb95",

  // Backgrounds / surfaces
  background: "#0f150f",
  surface: "#121a12",
  surfaceVariant: "#1a261a",
  card: "#1a261a",
  backgroundWhite: "#1a261a",
  backgroundLight: "#1a261a",
  backgroundMuted: "#1a261a",
  backgroundSoft: "#15201a",
  backgroundSubtle: "#15201a",
  backgroundTint: "#1a261a",
  backgroundAccent: "#1a261a",
  backgroundScaffold: "#15201a",

  // Text
  text: "#dde5da",
  textPrimary: "#dde5da",
  textSecondary: "#b9c3b8",
  textMuted: "#93a08f",
  textLight: "#b9c3b8",
  textSubtle: "#8a9588",
  textWhite: "#ffffff",
  textDark: "#dde5da",

  // Borders / outlines
  border: "#2a352a",
  borderLight: "#2a352a",
  borderSoft: "#2a352a",
  borderInput: "#3a453a",
  borderMuted: "#2a352a",
  borderDivider: "#2a352a",
  borderAccent: "#2a352a",
  outline: "#8a9588",

  // Status
  success: "#86d68b",
  warning: "#ffb86b",
  error: "#ffb4ab",
  info: "#82b1ff",
  successContainer: "#1a261a",
  errorContainer: "#3a1a1a",

  // Misc
  shadow: "#000000",
  overlay: "rgba(0,0,0,0.6)",
  overlayLight: "rgba(0,0,0,0.7)",
  scrim: "rgba(0,0,0,0.7)",
  divider: "#2a352a",
  disabled: "#3a453a",
  placeholder: "#8a9588",
  facebookBlue: "#1877F2",
  accentYellow: "#FFD700",
  accentYellowDark: "#e6c200",
  accentOrange: "#FF5722",
  transparent: "transparent",
  white: "#ffffff",
  black: "#000000",
} as const;

export type ColorTokens = typeof lightColors;
export type ColorKey = keyof ColorTokens;

/**
 * Resolve the correct color token set for the given color scheme.
 * Use this with `useColorScheme()` from `react-native` to pick the palette.
 */
export function getColors(scheme: "light" | "dark" | null | undefined) {
  return scheme === "dark" ? darkColors : lightColors;
}
