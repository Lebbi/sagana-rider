/**
 * app/pending.tsx — Sagana Rider
 *
 * Shown after a rider application is sent and when login answers
 * 403 RIDER_PENDING. The server refuses orders until the owner approves.
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthCornerOrnaments, LoginText } from "@/components/auth/BuyerAuthUi";
import { SaganaPressable } from "@/components/ui/SaganaPressable";
import { buyerLoginDesign as d, manrope } from "@/constants/buyerLoginDesign";
import { useT } from "@/lib/i18n";

export default function RiderPendingScreen() {
  const router = useRouter();
  const t = useT();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={d.screenBg} />
      <AuthCornerOrnaments />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.iconCircle}>
          <Ionicons name="hourglass-outline" size={44} color={d.onPrimary} />
        </View>
        <LoginText style={styles.title} accessibilityRole="header">
          {t("pending.title")}
        </LoginText>
        <LoginText style={styles.body}>{t("pending.body")}</LoginText>
        <SaganaPressable
          style={styles.primaryButton}
          onPress={() => router.replace("/login")}
          accessibilityRole="button"
        >
          <LoginText style={styles.primaryButtonText}>
            {t("pending.backToLogin")}
          </LoginText>
        </SaganaPressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: d.screenBg,
  },
  safeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: d.horizontalPadding,
  },
  iconCircle: {
    width: d.logoCircleSize,
    height: d.logoCircleSize,
    borderRadius: d.logoCircleSize / 2,
    backgroundColor: d.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: d.logoBottomSpacing,
  },
  title: {
    fontFamily: manrope.extraBold,
    fontSize: d.titleSize,
    color: d.primary,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontFamily: manrope.medium,
    fontSize: d.subtitleSize,
    color: d.subtitle,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    alignSelf: "stretch",
    height: d.controlHeight,
    borderRadius: d.radius,
    backgroundColor: d.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: manrope.bold,
    fontSize: d.buttonTextSize,
    color: "#FFFFFF",
  },
});
