/**
 * src/features/riders/presentation/screens/RiderOrdersPage.tsx
 *
 * Rider orders list — fetches from /api/rider/orders.
 * Tabs: All | New | Processing | Delivered | Pasabay
 *
 * @see docs/maps-implementation-plan.md
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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
    return []; // Pasabay tab renders batches, not orders
  }, [orders, activeTab]);

  const handleAcceptBatch = () => {
    router.push({
      pathname: "/tabs/(riders)/PasabayNavigationScreen",
      params: { batchId: "current" },
    } as any);
  };

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
              { width: "20%" },
              activeTab === "All"
                ? styles.tabsIndicatorAll
                : activeTab === "New"
                  ? styles.tabsIndicatorNew
                  : activeTab === "Processing"
                    ? styles.tabsIndicatorProcessing
                    : activeTab === "Delivered"
                      ? styles.tabsIndicatorDelivered
                      : styles.tabsIndicatorPasabay,
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

          {/* Pasabay tab — batch acceptance */}
          {activeTab === "Pasabay" && (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.orderText}>Pasabay Multi-Drop</Text>
                <View style={[styles.statusChip, styles.statusChipNew]}>
                  <Text style={styles.statusChipText}>AVAILABLE</Text>
                </View>
              </View>

              <View style={batchStyles.infoRow}>
                <MaterialIcons
                  name={IconTheme.infoCircle}
                  size={scale(16)}
                  color={colors.primary}
                />
                <Text
                  style={[batchStyles.infoText, { color: colors.textMuted }]}
                >
                  Accept a multi-order batch and the system will optimize your
                  route through all pickup and delivery stops.
                </Text>
              </View>

              <View style={styles.cardDivider} />

              <Pressable
                style={batchStyles.acceptButton}
                onPress={handleAcceptBatch}
                accessibilityRole="button"
                accessibilityLabel="Accept pasabay batch"
              >
                <MaterialIcons
                  name={IconTheme.checkCircle}
                  size={scale(18)}
                  color={colors.white}
                />
                <Text style={batchStyles.acceptButtonText}>
                  Find & Accept Batch
                </Text>
              </Pressable>
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
// Pasabay batch card styles
// ============================================================

const batchStyles = StyleSheet.create({
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
  },
  infoText: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    flex: 1,
    lineHeight: 18,
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#396B5C",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  acceptButtonText: {
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
    color: "#fff",
  },
});
