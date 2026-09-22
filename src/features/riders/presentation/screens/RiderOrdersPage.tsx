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
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { stylesFactory } from "@/features/riders/presentation/styles/RiderOrdersPage.styles";
import { SafeAreaView } from "react-native-safe-area-context";

import { scale } from "@/constants/DesignSystem";
import { fontFamily } from "@/constants/FontTheme";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
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
  const router = useRouter();
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
      setError(e?.message ?? "Failed to load orders");
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
          <Text style={styles.statusChipText}>COMPLETED</Text>
        </View>
      );
    }
    if (tab === "processing") {
      return (
        <View style={[styles.statusChip, styles.statusChipProcessing]}>
          <Text style={styles.statusChipText}>PROCESSING</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusChip, styles.statusChipNew]}>
        <Text style={styles.statusChipText}>NEW</Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Orders</Text>
        </View>

        <View style={styles.tabsWrap}>
          {ORDER_TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <Pressable
                key={tab}
                style={styles.tabButton}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  tabLayoutsRef.current[tab] = { x, width };
                  setTabLayouts({ ...tabLayoutsRef.current });
                }}
                onPress={() => setActiveTab(tab)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${tab} orders`}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    isActive ? styles.tabLabelActive : null,
                  ]}
                >
                  {tab}
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

        <ScrollView
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
        >
          {/* Loading state */}
          {isLoading && activeTab !== "Pasabay" && (
            <View style={stateStyles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[stateStyles.loadingText, { color: colors.textMuted }]}
              >
                Loading orders...
              </Text>
            </View>
          )}

          {/* Error state */}
          {error && !isLoading && activeTab !== "Pasabay" && (
            <View style={stateStyles.errorWrap}>
              <MaterialIcons
                name={IconTheme.alertCircle}
                size={40}
                color={colors.error}
              />
              <Text style={[stateStyles.errorTitle, { color: colors.text }]}>
                Could not load orders
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
                <Text style={stateStyles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {/* Pasabay tab — Coming Soon (no backend batch model yet) */}
          {activeTab === "Pasabay" && (
            <View style={batchStyles.comingSoon}>
              <MaterialIcons
                name={IconTheme.truck}
                size={scale(44)}
                color={colors.textMuted}
              />
              <Text style={batchStyles.comingSoonTitle}>
                Pasabay Multi-Drop
              </Text>
              <Text style={batchStyles.comingSoonText}>
                Batch deliveries with multiple farm stops in one run —
                coming soon.
              </Text>
            </View>
          )}

          {/* Order cards from API */}
          {!isLoading &&
            !error &&
            activeTab !== "Pasabay" &&
            visibleOrders.map((order) => (
              <View key={order.orderId} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.orderText}>
                    Order {order.orderNumber}
                  </Text>
                  {renderStatusChip(order.status)}
                </View>
                <Text style={styles.dateText}>
                  {formatDate(order.createdAt)}
                </Text>
                <View style={styles.cardDivider} />
                <Text style={styles.shippingText}>
                  Shipping Fee: ₱{order.shippingFee.toFixed(2)}
                </Text>
              </View>
            ))}

          {/* Empty state */}
          {!isLoading &&
            !error &&
            activeTab !== "Pasabay" &&
            visibleOrders.length === 0 && (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No orders in this tab yet.</Text>
              </View>
            )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// State styles (loading / error)
// ============================================================

const stateStyles = StyleSheet.create({
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
  },
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
