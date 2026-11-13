import { View, type DimensionValue, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = { width?: DimensionValue; height: number; radius?: number; style?: ViewStyle };

/** A flat placeholder block in the FE skeleton style (backgroundMuted, no shimmer). */
export function Skeleton({ width = "100%", height, radius = 8, style }: Props) {
  const colors = useColors();
  return (
    <View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.backgroundMuted }, style]}
    />
  );
}
