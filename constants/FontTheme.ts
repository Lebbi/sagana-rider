import { Platform, type TextStyle } from "react-native";

/**
 * FontTheme - Unified typography for the Sagana app.
 *
 * Uses Google Fonts' **Stack Sans Headline** for all text rendering.
 * Components MUST reference font tokens from this file instead of
 * hardcoding `fontFamily` / `fontWeight` strings.
 *
 * Variants provided by `@expo-google-fonts/stack-sans-headline`:
 *  - StackSansHeadline_200ExtraLight
 *  - StackSansHeadline_300Light
 *  - StackSansHeadline_400Regular
 *  - StackSansHeadline_500Medium
 *  - StackSansHeadline_600SemiBold
 *  - StackSansHeadline_700Bold
 */

// ---------- Font family tokens ----------
export const fontFamily = {
  extraLight: "StackSansHeadline_200ExtraLight",
  light: "StackSansHeadline_300Light",
  regular: "StackSansHeadline_400Regular",
  medium: "StackSansHeadline_500Medium",
  semiBold: "StackSansHeadline_600SemiBold",
  bold: "StackSansHeadline_700Bold",
} as const;

// Numeric weights that match the variants above.
export const fontWeight = {
  extraLight: "200",
  light: "300",
  regular: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
} as const;

export type FontFamilyKey = keyof typeof fontFamily;
export type FontWeightKey = keyof typeof fontWeight;

// ---------- Standard text styles ----------
/**
 * Semantic typography tokens. Use these in component `style` arrays.
 * Each token is a complete `TextStyle` so consumers don't have to set
 * fontFamily / fontWeight / fontSize / lineHeight separately.
 */
export const fontTheme: Record<string, TextStyle> = {
  // Display - largest, used for hero/screen titles
  displayLarge: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.25,
  },
  displaySmall: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: 32,
    lineHeight: 40,
  },

  // Headings
  h1: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: 30,
    lineHeight: 40,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: 26,
    lineHeight: 34,
  },
  h3: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: 22,
    lineHeight: 30,
  },
  h4: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 20,
    lineHeight: 28,
  },
  h5: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 18,
    lineHeight: 26,
  },
  h6: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 16,
    lineHeight: 24,
  },

  // Titles
  titleLarge: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  titleMedium: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  titleSmall: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },

  // Body
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 17,
    lineHeight: 26,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 14,
    lineHeight: 20,
  },

  // Labels (UI affordances - buttons, tabs, chips)
  labelLarge: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  labelMedium: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  labelSmall: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: 12,
    lineHeight: 18,
  },

  // Caption / micro copy
  caption: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  // Button
  button: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  buttonLarge: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  buttonSmall: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 14,
    lineHeight: 20,
  },

  // Input
  input: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  inputLabel: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: 14,
    lineHeight: 20,
  },

  // Links
  link: {
    fontFamily: fontFamily.semiBold,
    fontWeight: fontWeight.semiBold,
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: "underline",
  },
} as const;

export type FontThemeKey = keyof typeof fontTheme;

/**
 * Default text style applied globally to `<Text>` and `<TextInput>` in
 * the root layout. Ensures the custom font renders even if a component
 * forgets to set a `fontFamily` explicitly.
 */
export const defaultTextStyle: TextStyle = {
  fontFamily: fontFamily.regular,
  fontWeight: fontWeight.regular,
  fontSize: 15,
  lineHeight: 22,
  // Slight font-size boost on Android keeps visual parity with iOS.
  ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
};

export const defaultInputStyle: TextStyle = {
  fontFamily: fontFamily.regular,
  fontWeight: fontWeight.regular,
  fontSize: 15,
  lineHeight: 22,
};
