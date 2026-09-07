/**
 * src/features/riders/presentation/components/StopProgressCard.tsx
 *
 * Multi-stop progress card for Pasabay (multi-drop) deliveries.
 * Shows the current stop number out of total, the next stop address,
 * the stop type (pickup/delivery), and ETA.
 *
 * Renders:
 *   ┌─────────────────────────────────┐
 *   │  Stop 3 of 6                    │
 *   │  📍 Next: Farmer Jerome B.      │
 *   │     123 Mabini St, San Agustin  │
 *   │     ETA 4 min                   │
 *   │  [Pickup]                       │
 *   └─────────────────────────────────┘
 *
 * @see docs/maps-implementation-plan.md
 */

import { scale, verticalScale } from "@/constants/DesignSystem";
import { fontFamily } from "@/constants/FontTheme";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import { StyleSheet, Text, View } from "react-native";

// ============================================================
// Props
// ============================================================

export interface StopProgressCardProps {
  /** Current stop number (1-indexed). */
  currentStop: number;
  /** Total number of stops in the batch. */
  totalStops: number;
  /** Formatted address of the next stop. */
  nextStopAddress: string;
  /** Contact name at the next stop. */
  nextStopContactName?: string;
  /** Whether this stop is a pickup or delivery. */
  nextStopType: "pickup" | "delivery";
  /** ETA to the next stop in minutes. */
  etaMinutes: number;
  /** Distance to the next stop in kilometers. */
  distanceKm?: number;
}

// ============================================================
// Component
// ============================================================

export default function StopProgressCard({
  currentStop,
  totalStops,
  nextStopAddress,
  nextStopContactName,
  nextStopType,
  etaMinutes,
  distanceKm,
}: StopProgressCardProps) {
  const colors = useColors();

  const isPickup = nextStopType === "pickup";
  const progressPercent = totalStops > 0 ? (currentStop - 1) / totalStops : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Top row: stop counter + type badge */}
      <View style={styles.topRow}>
        <Text style={[styles.stopCounter, { color: colors.text }]}>
          Stop {currentStop} of {totalStops}
        </Text>
        <View
          style={[
            styles.typeBadge,
            {
              backgroundColor: isPickup
                ? colors.primaryContainer
                : colors.secondaryContainer,
            },
          ]}
        >
          <MaterialIcons
            name={isPickup ? IconTheme.store : IconTheme.home}
            size={scale(14)}
            color={colors.primary}
          />
          <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
            {isPickup ? "Pickup" : "Delivery"}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${Math.round(progressPercent * 100)}%`,
            },
          ]}
        />
      </View>

      {/* Next stop info */}
      <View style={styles.nextStopRow}>
        <MaterialIcons
          name={IconTheme.location}
          size={scale(20)}
          color={colors.primary}
        />
        <View style={styles.nextStopInfo}>
          {nextStopContactName && (
            <Text
              style={[styles.contactName, { color: colors.text }]}
              numberOfLines={1}
            >
              {nextStopContactName}
            </Text>
          )}
          <Text
            style={[styles.addressText, { color: colors.textMuted }]}
            numberOfLines={2}
          >
            {nextStopAddress}
          </Text>
        </View>
      </View>

      {/* ETA row */}
      <View style={styles.etaRow}>
        <MaterialIcons
          name={IconTheme.clock}
          size={scale(14)}
          color={colors.textMuted}
        />
        <Text style={[styles.etaText, { color: colors.textMuted }]}>
          {etaMinutes <= 0 ? "Arriving" : `ETA ${etaMinutes} min`}
          {distanceKm != null && distanceKm > 0
            ? ` • ${distanceKm.toFixed(1)} km`
            : ""}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: scale(16),
    padding: scale(16),
    gap: verticalScale(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stopCounter: {
    fontSize: scale(18),
    fontFamily: fontFamily.bold,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  typeBadgeText: {
    fontSize: scale(12),
    fontFamily: fontFamily.semiBold,
  },
  progressTrack: {
    height: scale(4),
    borderRadius: scale(2),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: scale(2),
  },
  nextStopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: scale(10),
  },
  nextStopInfo: {
    flex: 1,
    gap: verticalScale(2),
  },
  contactName: {
    fontSize: scale(14),
    fontFamily: fontFamily.semiBold,
  },
  addressText: {
    fontSize: scale(13),
    fontFamily: fontFamily.regular,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  etaText: {
    fontSize: scale(13),
    fontFamily: fontFamily.medium,
  },
});
