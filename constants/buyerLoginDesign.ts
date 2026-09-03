// constants/buyerLoginDesign.ts
// Design tokens for the buyer authentication screens (login / register / forgot).
// Uses the project's shared ColorTheme and FontTheme so the screens stay consistent
// with the rest of the app and support light/dark mode automatically.

import { lightColors } from "@/constants/ColorTheme";
import { fontFamily } from "@/constants/FontTheme";

export const buyerLoginDesign = {
  // Background
  screenBg: lightColors.background,

  // Brand / text
  primary: lightColors.primary,
  onPrimary: lightColors.onPrimary,
  logoOnPrimary: lightColors.onPrimary,
  subtitle: lightColors.textSecondary,
  forgotLink: lightColors.textMuted,
  footerMuted: lightColors.textMuted,
  required: lightColors.error,
  divider: lightColors.divider,

  // Inputs
  inputBg: lightColors.card,
  inputBorder: lightColors.outline,

  // Google button
  googleButtonBg: lightColors.card,

  // Sizing
  horizontalPadding: 24,
  controlHeight: 52,
  radius: 12,
  fieldGap: 18,
  labelToInput: 8,
  heroBottomSpacing: 32,
  logoCircleSize: 88,
  logoBottomSpacing: 20,
  logoIconSize: 48,

  // Typography (Stack Sans Headline)
  titleSize: 28,
  subtitleSize: 15,
  labelSize: 14,
  bodySize: 15,
  buttonTextSize: 16,
} as const;

export const manrope = {
  regular: fontFamily.regular,
  medium: fontFamily.medium,
  semiBold: fontFamily.semiBold,
  bold: fontFamily.bold,
  extraBold: fontFamily.bold,
} as const;
