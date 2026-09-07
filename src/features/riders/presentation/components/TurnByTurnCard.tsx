/**
 * src/features/riders/presentation/components/TurnByTurnCard.tsx
 *
 * Shows the current navigation instruction + speaks it via expo-speech.
 * Triggers haptic feedback when approaching a turn.
 *
 * @see docs/maps-implementation-plan.md
 */

import { scale, verticalScale } from "@/constants/DesignSystem";
import { fontFamily } from "@/constants/FontTheme";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import type { ManeuverType, RouteStep } from "@/types/maps";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

export interface TurnByTurnCardProps {
  /** Current step the rider is on. Null while loading. */
  currentStep: RouteStep | null;
  /** Next step after current. Null if this is the last step. */
  nextStep: RouteStep | null;
  /** Distance to next maneuver point in meters (calculated from GPS). */
  distanceToNextStep: number;
  /** Current ETA in minutes. */
  etaMinutes: number;
}

// ============================================================
// Maneuver → Icon mapping
// ============================================================

const MANEUVER_ICONS: Record<ManeuverType, string> = {
  "turn-left": "turn-slight-left",
  "turn-right": "turn-slight-right",
  "turn-slight-left": "turn-slight-left",
  "turn-slight-right": "turn-slight-right",
  "turn-sharp-left": "turn-sharp-left",
  "turn-sharp-right": "turn-sharp-right",
  straight: "straight",
  uturn: "u-turn-left",
  arrive: "location-on",
  depart: "navigation",
  roundabout: "roundabout",
  merge: "merge",
  fork: "alt-route",
};

// ============================================================
// Component
// ============================================================

export default function TurnByTurnCard({
  currentStep,
  nextStep,
  distanceToNextStep,
  etaMinutes,
}: TurnByTurnCardProps) {
  const colors = useColors();
  const lastSpokenStepRef = useRef<string | null>(null);
  const lastHapticDistanceRef = useRef<number | null>(null);

  // ----------------------------------------------------------
  // Voice + haptic triggers
  // ----------------------------------------------------------

  const speakInstruction = useCallback((instruction: string) => {
    Speech.speak(instruction, {
      language: "en",
      rate: 0.9,
      pitch: 1.0,
    });
  }, []);

  const triggerHaptic = useCallback(async (style: "light" | "success") => {
    try {
      if (style === "success") {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics not available on this device
    }
  }, []);

  // Speak new instruction when step changes
  useEffect(() => {
    if (!currentStep) return;

    const stepKey = `${currentStep.instruction}-${currentStep.distance}`;
    if (lastSpokenStepRef.current === stepKey) return;
    lastSpokenStepRef.current = stepKey;

    // Don't speak on depart (too early)
    if (currentStep.maneuver === "depart") return;

    speakInstruction(currentStep.instruction);
  }, [currentStep, speakInstruction]);

  // Haptic when approaching turn (< 100m)
  useEffect(() => {
    if (!currentStep || distanceToNextStep <= 0) return;

    if (distanceToNextStep < 100 && lastHapticDistanceRef.current === null) {
      lastHapticDistanceRef.current = distanceToNextStep;
      triggerHaptic("light");
    }

    // Reset haptic ref when we move to a new step
    if (distanceToNextStep > 200) {
      lastHapticDistanceRef.current = null;
    }
  }, [distanceToNextStep, currentStep, triggerHaptic]);

  // Speak arrival + success haptic
  useEffect(() => {
    if (!currentStep || currentStep.maneuver !== "arrive") return;

    const stepKey = `arrive-${currentStep.instruction}`;
    if (lastSpokenStepRef.current === stepKey) return;
    lastSpokenStepRef.current = stepKey;

    speakInstruction("You have arrived at your destination");
    triggerHaptic("success");
  }, [currentStep, speakInstruction, triggerHaptic]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (!currentStep) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <MaterialIcons
          name={IconTheme.navigation}
          size={scale(28)}
          color={colors.primary}
        />
        <Text
          style={[styles.instructionText, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          Calculating route...
        </Text>
      </View>
    );
  }

  const iconName = MANEUVER_ICONS[currentStep.maneuver] ?? "navigation";
  const distanceText =
    distanceToNextStep > 0
      ? distanceToNextStep < 1000
        ? `${Math.round(distanceToNextStep)} m`
        : `${(distanceToNextStep / 1000).toFixed(1)} km`
      : currentStep.distance > 0
        ? currentStep.distance < 1000
          ? `${Math.round(currentStep.distance)} m`
          : `${(currentStep.distance / 1000).toFixed(1)} km`
        : "";

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Maneuver icon */}
      <View
        style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}
      >
        <MaterialIcons
          name={iconName as any}
          size={scale(28)}
          color={colors.primary}
        />
      </View>

      {/* Instruction + distance */}
      <View style={styles.textWrap}>
        <Text
          style={[styles.instructionText, { color: colors.text }]}
          numberOfLines={2}
        >
          {currentStep.instruction}
        </Text>
        <View style={styles.metaRow}>
          {distanceText ? (
            <Text
              style={[styles.distanceText, { color: colors.textSecondary }]}
            >
              {distanceText}
            </Text>
          ) : null}
          {nextStep ? (
            <Text
              style={[styles.nextStepText, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              Then: {nextStep.instruction}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ETA */}
      <View style={styles.etaWrap}>
        <Text style={[styles.etaText, { color: colors.primary }]}>
          {etaMinutes}
        </Text>
        <Text style={[styles.etaLabel, { color: colors.textSecondary }]}>
          min
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    borderRadius: scale(16),
    gap: scale(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  iconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: verticalScale(2),
  },
  instructionText: {
    fontFamily: fontFamily.semiBold,
    fontSize: scale(15),
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  distanceText: {
    fontFamily: fontFamily.medium,
    fontSize: scale(13),
    fontWeight: "500",
  },
  nextStepText: {
    fontFamily: fontFamily.regular,
    fontSize: scale(12),
    flex: 1,
  },
  etaWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: scale(44),
  },
  etaText: {
    fontFamily: fontFamily.bold,
    fontSize: scale(20),
    fontWeight: "700",
  },
  etaLabel: {
    fontFamily: fontFamily.regular,
    fontSize: scale(10),
  },
});
