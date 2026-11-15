import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { stylesFactory } from "@/features/riders/presentation/styles/RiderWalletPage.styles";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useT, type TextKey } from "@/lib/i18n";
import { WALLET_NO_EARNINGS } from "@/lib/riderEmptyStates";
import { getRiderWallet, type RiderWalletData } from "@/lib/riderProfileApi";
import { getRiderWithdrawals, type RiderWithdrawal } from "@/lib/riderWithdrawal";
import { RiderWithdrawSection } from "@/features/riders/presentation/components/RiderWithdrawSection";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";

const WALLET_INFO: { heading: TextKey; body: TextKey }[] = [
  { heading: "wallet.earningsHeading", body: "wallet.earningsBody" },
  { heading: "wallet.balanceHeading", body: "wallet.balanceBody" },
  { heading: "wallet.withdrawHeading", body: "wallet.withdrawBody" },
];

const SKELETON_BARS = [40, 64, 28, 52, 72, 36, 48];

export default function RiderWalletPage() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const [wallet, setWallet] = useState<RiderWalletData | null>(null);
  const [withdrawals, setWithdrawals] = useState<RiderWithdrawal[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
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
          const [data, history] = await Promise.all([
            getRiderWallet(),
            // An older server has no withdrawals route; the wallet still shows.
            getRiderWithdrawals().catch(() => [] as RiderWithdrawal[]),
          ]);
          if (!mounted) return;
          setWallet(data);
          setWithdrawals(history);
        } catch (e) {
          if (__DEV__) console.warn("[RiderWallet] Failed to fetch:", e);
        } finally {
          if (mounted) setIsLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [reloadKey]),
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
          <Text style={styles.headerTitle}>{t("wallet.title")}</Text>
          <Pressable
            style={styles.headerInfoButton}
            onPress={() => setIsInfoVisible(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.infoTitle")}
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
          <Text style={styles.sectionHeading}>{t("wallet.thisWeek")}</Text>
          <View style={styles.earningsCard}>
            {isLoading ? (
              <View
                style={styles.chartRow}
                accessible
                accessibilityLabel={t("common.loading")}
                accessibilityState={{ busy: true }}
              >
                {SKELETON_BARS.map((pct, i) => (
                  <View key={i} style={styles.chartColumn}>
                    <View style={styles.chartBarTrack}>
                      <Skeleton height={pct} radius={6} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.chartRow}>
                {weeklyEarnings.map((entry, index) => (
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
                        // The server sends the last 7 days ending today.
                        index === weeklyEarnings.length - 1 ? styles.chartDayLabelActive : null,
                      ]}
                    >
                      {entry.day}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.chartCaption}>
              {t("wallet.activity")}
            </Text>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{t("wallet.available")}</Text>
            {isLoading ? (
              <Skeleton width={140} height={32} style={{ marginVertical: 4 }} />
            ) : (
              <Text style={styles.balanceAmount}>
                {formatPeso(wallet?.available_balance ?? 0)}
              </Text>
            )}
            <Text style={styles.balanceSubLabel}>
              {t("wallet.total", { amount: isLoading ? "—" : formatPeso(wallet?.total_earnings ?? 0) })}
            </Text>
          </View>

          {!isLoading && wallet?.withdrawable !== undefined ? (
            <RiderWithdrawSection
              withdrawable={wallet.withdrawable}
              min={wallet.min_withdraw ?? 100}
              withdrawals={withdrawals}
              formatPeso={formatPeso}
              onRequested={() => setReloadKey((k) => k + 1)}
            />
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("wallet.recent")}</Text>
            {isLoading ? (
              <View style={{ gap: 8 }}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="55%" height={14} />
                <Skeleton width="62%" height={14} />
              </View>
            ) : (wallet?.recent_earnings ?? []).length > 0 ? (
              (wallet?.recent_earnings ?? []).map((earning, idx) => (
                <Text key={idx} style={styles.cardText}>
                  {earning.date} - {formatPeso(earning.amount)}
                </Text>
              ))
            ) : (
              <EmptyState
                state={WALLET_NO_EARNINGS}
                compact
                onAction={() => router.navigate("/tabs" as never)}
              />
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
            <Text style={styles.modalTitle}>{t("wallet.infoTitle")}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {WALLET_INFO.map(({ heading, body }) => (
                <View key={heading} style={styles.modalSection}>
                  <Text style={styles.modalHeading}>{t(heading)}</Text>
                  <Text style={styles.modalBody}>{t(body)}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setIsInfoVisible(false)}
              accessibilityRole="button"
            >
              <Text style={styles.modalCloseText}>{t("common.close")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
