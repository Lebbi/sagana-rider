import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { stylesFactory } from "@/features/riders/presentation/styles/RiderWalletPage.styles";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getRiderWallet, type RiderWalletData } from "@/lib/riderProfileApi";
import { useEffect, useState } from "react";

export default function RiderWalletPage() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const [wallet, setWallet] = useState<RiderWalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
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
  }, []);

  const weeklyEarnings = wallet?.weekly_earnings ?? [];
  const highestBarValue = Math.max(
    1,
    ...weeklyEarnings.map((item) => item.value),
  );

  const formatPeso = (amount: number) =>
    `₱${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
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
            <Text style={styles.cardTitle}>Recent Payouts</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (wallet?.recent_payouts ?? []).length > 0 ? (
              (wallet?.recent_payouts ?? []).map((payout, idx) => (
                <Text key={idx} style={styles.cardText}>
                  {payout.date} - {formatPeso(payout.amount)}
                </Text>
              ))
            ) : (
              <Text style={styles.cardText}>No payouts yet</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
