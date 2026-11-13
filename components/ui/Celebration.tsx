import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";

import { fontFamily } from "@/constants/FontTheme";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";

export const CELEBRATION_HOLD_MS = 2200;

type Props = { title: string; body: string; onDone: () => void };

/**
 * A short pop-in card that leaves on its own and never blocks taps.
 * With reduced motion it appears and disappears without scaling.
 */
export function Celebration({ title, body, onDone }: Props) {
  const colors = useColors();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => live && setReduceMotion(on))
      .catch(() => live && setReduceMotion(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
    const enter = reduceMotion
      ? Animated.timing(progress, { toValue: 1, duration: 0, useNativeDriver: true })
      : Animated.spring(progress, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true });
    const leave = Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: true,
    });
    const run = Animated.sequence([enter, Animated.delay(CELEBRATION_HOLD_MS), leave]);
    run.start(({ finished }) => finished && onDone());
    return () => run.stop();
  }, [reduceMotion, progress, title, body, onDone]);

  const scale = reduceMotion
    ? 1
    : progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.card, opacity: progress, transform: [{ scale }] },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
          <MaterialIcons name={IconTheme.celebration} size={30} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 20,
    maxWidth: 320,
    shadowColor: "#1d3b55",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontFamily: fontFamily.bold, textAlign: "center" },
  body: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular, textAlign: "center" },
});
