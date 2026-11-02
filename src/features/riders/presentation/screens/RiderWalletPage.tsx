import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { stylesFactory } from "@/features/riders/presentation/styles/RiderWalletPage.styles";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getRiderWallet, type RiderWalletData } from "@/lib/riderProfileApi";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

// Keep this true to PAY-07: the backend has no rider withdrawal yet.
const WALLET_INFO = [
  {
    heading: "Earnings",
    body: "You get the delivery fee for each order you deliver. It's added to your balance when the order is marked delivered.",
  },
  {
    heading: "Your balance",
    body: "Available Balance adds up your delivery earnings. Total earnings is everything you've earned since you started.",
  },
  {
    heading: "Withdrawals",
    body: "You can't withdraw from the app yet, so this balance can't be cashed out here for now.",
  },
];

export default function RiderWalletPage() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const insets = useSafeAreaInsets();
  const [wallet, setWallet] = useState<RiderWalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInfoVisible, setIsInfoVisible] = useState(false);

  // useFocusEffect re-fetches whenever the rider returns to this tab
  // (e.g. after completing a delivery) — useEffect only ran on mount.
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setIsLoading(true);
      (async () => {
        try {
          const data = await getRiderWallet();
          if (!mounted) return;
          setWallet(data);
        } catch (e) {
          if (__DEV__) console.warn("[RiderWallet] Failed to fetch:", e);
        } finally {
          if (mounted) setIsLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  const weeklyEarnings = wallet?.weekly_earnings ?? [];
  const highestBarValue = Math.max(
    1,
    ...weeklyEarnings.map((item) => item.value),
  );

  const formatPeso = (amount: number) =>
    `₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.headerTitle}>Wallet</Text>
          <Pressable
            style={styles.headerInfoButton}
            onPress={() => setIsInfoVisible(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="How your wallet works"
          >
            <MaterialIcons
              name={IconTheme.infoCircleOutlined}
              size={22}
              color={colors.text}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionHeading}>This Week Earnings</Text>
          <View style={styles.earningsCard}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={styles.chartRow}>
                {weeklyEarnings.map((entry) => (
                  <View key={entry.day} style={styles.chartColumn}>
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: `${Math.max(8, Math.round((entry.value / highestBarValue) * 100))}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.chartDayLabel,
                        entry.day === "SUN" ? styles.chartDayLabelActive : null,
                      ]}
                    >
                      {entry.day}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.chartCaption}>
              Earning Activity (Last 7 Days)
            </Text>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>
              {isLoading ? "—" : formatPeso(wallet?.available_balance ?? 0)}
            </Text>
            <Text style={styles.balanceSubLabel}>
              Total earnings:{" "}
              {isLoading ? "—" : formatPeso(wallet?.total_earnings ?? 0)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Earnings</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (wallet?.recent_earnings ?? []).length > 0 ? (
              (wallet?.recent_earnings ?? []).map((earning, idx) => (
                <Text key={idx} style={styles.cardText}>
                  {earning.date} - {formatPeso(earning.amount)}
                </Text>
              ))
            ) : (
              <Text style={styles.cardText}>No earnings yet</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isInfoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsInfoVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsInfoVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => null}>
            <Text style={styles.modalTitle}>How your wallet works</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {WALLET_INFO.map(({ heading, body }) => (
                <View key={heading} style={styles.modalSection}>
                  <Text style={styles.modalHeading}>{heading}</Text>
                  <Text style={styles.modalBody}>{body}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setIsInfoVisible(false)}
              accessibilityRole="button"
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
