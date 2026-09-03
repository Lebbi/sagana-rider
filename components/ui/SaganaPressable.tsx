// components/ui/SaganaPressable.tsx
// A pressable wrapper that provides consistent ripple / opacity feedback
// across Android and iOS. Replaces direct TouchableOpacity usage for new code.

import { type ReactNode } from "react";
import {
    Pressable,
    type PressableProps,
    StyleSheet,
    type ViewStyle,
} from "react-native";

import {
    saganaRippleConfig,
    saganaTouchableActiveOpacity,
} from "@/constants/pressFeedback";

interface SaganaPressableProps extends PressableProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  rippleVariant?: "default" | "neutral";
}

export function SaganaPressable({
  children,
  style,
  rippleVariant = "default",
  android_ripple,
  ...rest
}: SaganaPressableProps) {
  const ripple =
    android_ripple ??
    (rippleVariant === "neutral"
      ? { ...saganaRippleConfig, color: "rgba(0, 0, 0, 0.08)" }
      : saganaRippleConfig);

  return (
    <Pressable
      android_ripple={ripple}
      style={({ pressed }) => [
        styles.base,
        style,
        pressed && { opacity: saganaTouchableActiveOpacity },
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
});
