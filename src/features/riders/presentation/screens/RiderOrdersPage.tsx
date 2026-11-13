/**
 * src/features/riders/presentation/screens/RiderOrdersPage.tsx
 *
 * Rider orders list — fetches from /api/rider/orders.
 * Tabs: All | New | Processing | Delivered | Pasabay
 *
 * @see docs/maps-implementation-plan.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { stylesFactory } from "@/features/riders/presentation/styles/RiderOrdersPage.styles";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { scale } from "@/constants/DesignSystem";
import { fontFamily } from "@/constants/FontTheme";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import { useT, type TextKey } from "@/lib/i18n";
import { ordersEmptyState } from "@/lib/riderEmptyStates";
import { getRiderOrders } from "@/lib/riderOrdersApi";
import type { DeliveryStatus, RiderOrder } from "@/types/maps";
import { useRouter } from "expo-router";

// ============================================================
// Types & helpers
// ============================================================

type OrderTab = "All" | "New" | "Processing" | "Delivered" | "Pasabay";

const ORDER_TABS: OrderTab[] = [
  "All",
  "New",
  "Processing",
  "Delivered",
  "Pasabay",
];

const TAB_LABELS: Record<OrderTab, TextKey> = {
  All: "orders.tabAll",
  New: "orders.tabNew",
  Processing: "orders.tabProcessing",
  Delivered: "orders.tabDelivered",
  Pasabay: "orders.tabPasabay",
};

/** Maps a DeliveryStatus (from the API) to the simplified tab filter. */
function mapStatusToTab(
  status: DeliveryStatus,
): "new" | "processing" | "completed" | "cancelled" {
  if (status === "searching" || status === "accepted") return "new";
  if (
    status === "to_pickup" ||
    status === "arrived_pickup" ||
    status === "picked_up" ||
    status === "to_delivery" ||
    status === "arrived_delivery"
  )
    return "processing";
  if (status === "delivered") return "completed";
  return "cancelled";
}

/** Formats an ISO date string into a readable label. */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ============================================================
// Component
// ============================================================

export default function RiderOrdersPage() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const [activeTab, setActiveTab] = useState<OrderTab>("All");

  // Measured tab geometry for the underline indicator. The old hardcoded
  // percentages (25% steps from a 4-tab layout) drifted under the wrong
  // labels — measuring each button on layout keeps the indicator exactly
  // centered under the active tab regardless of label widths.
  const tabLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const [tabLayouts, setTabLayouts] = useState<
    Record<string, { x: number; width: number }>
  >({});
  const indicatorWidth = scale(28);
  const activeLayout = tabLayouts[activeTab];
  const indicatorLeft = activeLayout
    ? activeLayout.x + (activeLayout.width - indicatorWidth) / 2
    : 0;

  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders from API
  const fetchOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const data = await getRiderOrders();
      setOrders(data);
    } catch (e: any) {
      if (__DEV__) {
        console.warn("[RiderOrdersPage] Failed to fetch orders:", e);
      }
      setError(e?.message ?? t("orders.loadFailed"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders by active tab
  const visibleOrders = useMemo(() => {
    if (activeTab === "All") {
      return orders.filter((o) => o.status !== "cancelled");
    }
    if (activeTab === "New") {
      return orders.filter((o) => mapStatusToTab(o.status) === "new");
    }
    if (activeTab === "Processing") {
      return orders.filter((o) => mapStatusToTab(o.status) === "processing");
    }
    if (activeTab === "Delivered") {
      return orders.filter((o) => mapStatusToTab(o.status) === "completed");
    }
    return []; // Pasabay tab renders Coming Soon, not orders
  }, [orders, activeTab]);

  const renderStatusChip = (status: DeliveryStatus) => {
    const tab = mapStatusToTab(status);
    if (tab === "completed") {
      return (
        <View style={[styles.statusChip, styles.statusChipCompleted]}>
          <Text style={styles.statusChipText} numberOfLines={1} adjustsFontSizeToFit>{t("orders.chipCompleted")}</Text>
        </View>
      );
    }
    if (tab === "processing") {
      return (
        <View style={[styles.statusChip, styles.statusChipProcessing]}>
          <Text style={styles.statusChipText} numberOfLines={1} adjustsFontSizeToFit>{t("orders.chipProcessing")}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusChip, styles.statusChipNew]}>
        <Text style={styles.statusChipText} numberOfLines={1} adjustsFontSizeToFit>{t("orders.chipNew")}</Text>
      </View>
    );
  };

  const renderListEmpty = () => {
    if (activeTab === "Pasabay") {
      return (
        <View style={batchStyles.comingSoon}>
          <MaterialIcons
            name={IconTheme.truck}
            size={scale(44)}
            color={colors.textMuted}
          />
          <Text style={batchStyles.comingSoonTitle}>
            {t("orders.pasabayTitle")}
          </Text>
          <Text style={batchStyles.comingSoonText}>
            {t("orders.pasabayBody")}
          </Text>
        </View>
      );
    }
    if (isLoading) {
      return (
        <View
          style={stateStyles.skeletonList}
          accessible
          accessibilityLabel={t("orders.loading")}
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardTopRow}>
                <Skeleton width="45%" height={16} />
                <Skeleton width={64} height={20} radius={10} />
              </View>
              <Skeleton width="60%" height={12} style={stateStyles.skeletonGap} />
              <View style={styles.cardDivider} />
              <Skeleton width="40%" height={12} />
            </View>
          ))}
        </View>
      );
    }
    if (error) {
      return (
        <View style={stateStyles.errorWrap}>
          <MaterialIcons
            name={IconTheme.alertCircle}
            size={40}
            color={colors.error}
          />
          <Text style={[stateStyles.errorTitle, { color: colors.text }]}>
            {t("orders.couldNotLoad")}
          </Text>
          <Text
            style={[stateStyles.errorDesc, { color: colors.textMuted }]}
          >
            {error}
          </Text>
          <Pressable
            style={[
              stateStyles.retryButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={() => fetchOrders()}
          >
            <Text style={stateStyles.retryButtonText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <EmptyState
        state={ordersEmptyState(activeTab, orders.some((o) => o.status !== "cancelled"))}
        onAction={() => router.navigate("/tabs" as never)}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.headerTitle}>{t("orders.title")}</Text>
        </View>

        <View style={styles.tabsWrap}>
          {ORDER_TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <Pressable
                key={tab}
                style={styles.tabButton}
                hitSlop={{ top: 6, bottom: 6 }}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  tabLayoutsRef.current[tab] = { x, width };
                  setTabLayouts({ ...tabLayoutsRef.current });
                }}
                onPress={() => setActiveTab(tab)}
                accessibilityRole="button"
                accessibilityLabel={t("orders.showTab", { tab: t(TAB_LABELS[tab]) })}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    isActive ? styles.tabLabelActive : null,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {t(TAB_LABELS[tab])}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.tabsDivider}>
          <View
            style={[
              styles.tabsIndicator,
              {
                width: indicatorWidth,
                left: indicatorLeft,
                opacity: activeLayout ? 1 : 0,
              },
            ]}
          />
        </View>

        <FlatList
          data={isLoading || error || activeTab === "Pasabay" ? [] : visibleOrders}
          keyExtractor={(order) => String(order.orderId)}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchOrders(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderListEmpty}
          renderItem={({ item: order }) => (
            <Pressable
              key={order.orderId}
              style={styles.card}
              onPress={() => router.push(`/rider/orders/${order.orderId}` as never)}
              accessibilityRole="button"
              accessibilityLabel={t("orders.viewOrder", { number: order.orderNumber })}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.orderText}>
                  {t("common.orderNumber", { number: order.orderNumber })}
                </Text>
                {renderStatusChip(order.status)}
              </View>
              <Text style={styles.dateText}>
                {formatDate(order.createdAt)}
              </Text>
              <View style={styles.cardDivider} />
              <Text style={styles.shippingText}>
                {t("orders.shippingFee", { amount: order.shippingFee.toFixed(2) })}
              </Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// State styles (loading / error)
// ============================================================

const stateStyles = StyleSheet.create({
  skeletonList: { gap: 10 },
  skeletonGap: { marginTop: 8 },
  errorWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  errorDesc: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
    color: "#fff",
  },
});

// ============================================================
// Pasabay Coming Soon styles
// ============================================================

const batchStyles = StyleSheet.create({
  comingSoon: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: "#396B5C",
  },
  comingSoonText: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    textAlign: "center",
    lineHeight: 18,
  },
});
