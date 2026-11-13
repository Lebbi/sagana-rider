import { StyleSheet, Text, View } from "react-native";

import { SaganaPressable } from "@/components/ui/SaganaPressable";
import { fontFamily } from "@/constants/FontTheme";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import type { EmptyState as EmptyStateModel } from "@/lib/riderEmptyStates";

type Props = { state: EmptyStateModel; onAction?: () => void; compact?: boolean };

/** Says why a screen is empty and, when there is one, the next step. */
export function EmptyState({ state, onAction, compact }: Props) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="summary">
      {!compact && (
        <View style={[styles.iconCircle, { backgroundColor: colors.backgroundMuted }]}>
          <MaterialIcons name={IconTheme[state.icon]} size={28} color={colors.primary} />
        </View>
      )}
      <Text style={[styles.title, { color: colors.text }]}>{t(state.title)}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t(state.body)}</Text>
      {state.action && onAction && (
        <SaganaPressable
          style={[styles.action, { backgroundColor: colors.primary }]}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{t(state.action)}</Text>
        </SaganaPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  compact: { paddingVertical: 12, paddingHorizontal: 4, gap: 4 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 16, fontFamily: fontFamily.bold, textAlign: "center" },
  body: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular, textAlign: "center" },
  action: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 10,
    justifyContent: "center",
  },
  actionText: { fontSize: 14, fontFamily: fontFamily.semiBold, color: "#fff" },
});
