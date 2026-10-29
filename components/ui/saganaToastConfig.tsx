// components/ui/saganaToastConfig.tsx
// Sagana toast pop-up rule, ported from sagana-frontend and adapted to
// the rider app's tokens (MaterialIcons, saganaPalette, Stack Sans Headline,
// SaganaPressable). Pastel card + watermark + icon circle motif.

import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import Toast, { type ToastConfig, type ToastConfigParams } from "react-native-toast-message";

import { SaganaPressable } from "@/components/ui/SaganaPressable";
import { fontFamily } from "@/constants/FontTheme";
import { saganaPalette } from "@/constants/ColorTheme";

type SaganaToastVariant = "success" | "error" | "info";
type MciName = ComponentProps<typeof MaterialIcons>["name"];

/**
 * Pastel fills + watermark tint — same motif as the frontend `saganaToastConfig`.
 */
const VOUCHER_CARD_BG = {
  success: "#EEF6E8",
  info: "#F2F7ED",
  error: "#FBEDED",
} as const;

const PRIMARY_RGB = "57, 107, 92";
const WATERMARK_TINT_PRIMARY = `rgba(${PRIMARY_RGB}, 0.13)`;
const ERROR_RGB = "186, 26, 26";
const WATERMARK_TINT_ERROR = `rgba(${ERROR_RGB}, 0.11)`;

const VARIANT: Record<
  SaganaToastVariant,
  {
    cardBg: string;
    iconBg: string;
    iconName: MciName;
    watermarkName: MciName;
    watermarkTint: string;
  }
> = {
  success: {
    cardBg: VOUCHER_CARD_BG.success,
    iconBg: saganaPalette.primary,
    iconName: "check",
    watermarkName: "agriculture",
    watermarkTint: WATERMARK_TINT_PRIMARY,
  },
  info: {
    cardBg: VOUCHER_CARD_BG.info,
    iconBg: saganaPalette.primary,
    iconName: "info",
    watermarkName: "eco",
    watermarkTint: WATERMARK_TINT_PRIMARY,
  },
  error: {
    cardBg: VOUCHER_CARD_BG.error,
    iconBg: saganaPalette.error,
    iconName: "warning",
    watermarkName: "warning",
    watermarkTint: WATERMARK_TINT_ERROR,
  },
};

/** Matches the frontend toast icon circle (24 x 24, white glyph ~12). */
const VOUCHER_ICON_CIRCLE = 24;
const VOUCHER_ICON_GLYPH = 12;

export interface SaganaToastPressProps {
  actionHint?: string;
}

export interface ShowSaganaToastOpts {
  type: SaganaToastVariant;
  text1: string;
  text2?: string;
  actionHint?: string;
  onPress?: () => void;
  visibilityTime?: number;
}

function SaganaToastContent({
  variant,
  params,
}: {
  variant: SaganaToastVariant;
  params: ToastConfigParams<unknown>;
}) {
  const { text1, text2, onPress, text1Style, text2Style, props } = params;
  const v = VARIANT[variant];
  const actionHint = (props as SaganaToastPressProps | undefined)?.actionHint;
  // Library types declare onPress as always-defined, but it is undefined at
  // runtime when the toast was shown without an onPress handler.
  const onPressHandler = onPress as (() => void) | undefined;

  const headline = (text1 && String(text1).trim()) || (text2 && String(text2).trim()) || "Update";
  const detail =
    text1 && text2 && String(text2).trim().length > 0 ? String(text2).trim() : undefined;

  return (
    <SaganaPressable
      onPress={onPressHandler}
      disabled={!onPressHandler}
      style={styles.pressable}
      accessibilityRole={onPressHandler ? "button" : "alert"}
      accessibilityLabel={[headline, detail].filter(Boolean).join(". ")}
      accessibilityHint={onPressHandler ? actionHint : undefined}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.card, { backgroundColor: v.cardBg }]}>
        <MaterialIcons
          name={v.watermarkName}
          size={52}
          color={v.watermarkTint}
          style={styles.watermark}
          pointerEvents="none"
        />
        <View style={[styles.headerRow, detail ? styles.headerRowWithDetail : null]}>
          <View style={[styles.iconCircle, { backgroundColor: v.iconBg }]}>
            <MaterialIcons
              name={v.iconName}
              size={VOUCHER_ICON_GLYPH}
              color={saganaPalette.onPrimary}
            />
          </View>
          <Text
            style={[text1Style as StyleProp<TextStyle>, styles.title]}
            numberOfLines={2}
          >
            {headline}
          </Text>
        </View>
        {detail ? (
          <Text
            style={[text2Style as StyleProp<TextStyle>, styles.subtitle]}
            numberOfLines={3}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </SaganaPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: "stretch",
    marginHorizontal: 16,
    marginVertical: 6,
  },
  card: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: "hidden",
    position: "relative",
    minHeight: 72,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  watermark: {
    position: "absolute",
    right: -6,
    bottom: -8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 40,
  },
  headerRowWithDetail: {
    marginBottom: 5,
  },
  iconCircle: {
    width: VOUCHER_ICON_CIRCLE,
    height: VOUCHER_ICON_CIRCLE,
    borderRadius: VOUCHER_ICON_CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: saganaPalette.onSurface,
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 19,
  },
  subtitle: {
    color: saganaPalette.onSurfaceVariant,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    paddingRight: 36,
  },
});

export const saganaToastConfig: ToastConfig = {
  success: (params) => <SaganaToastContent variant="success" params={params} />,
  error: (params) => <SaganaToastContent variant="error" params={params} />,
  info: (params) => <SaganaToastContent variant="info" params={params} />,
};

/**
 * Show a Sagana toast. The toast auto-dismisses; pass `onPress` for a tap action
 * (e.g. open system settings). `actionHint` is read by screen readers.
 */
export function showSaganaToast(opts: ShowSaganaToastOpts) {
  Toast.show({
    type: opts.type,
    text1: opts.text1,
    text2: opts.text2,
    visibilityTime: opts.visibilityTime ?? 4000,
    onPress: opts.onPress,
    props: { actionHint: opts.actionHint },
  });
}