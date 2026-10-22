import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { fontFamily } from "@/constants/FontTheme";
import { getRiderOrderById } from "@/lib/riderOrdersApi";
import { acceptOrder } from "@/lib/riderOrdersApi";
import { handleApiError, handleApiSuccess } from "@/utils/errorHandler";
import type { DeliveryStatus, RiderOrder } from "@/types/maps";

const BRAND_LOGO = require("@/assets/branding/sagana-wordform-logo.png");

// Status order for timeline
const STATUS_TIMELINE: { status: DeliveryStatus; label: string; icon: string }[] = [
  { status: "searching", label: "Searching for Rider", icon: "radio-button-unchecked" },
  { status: "accepted", label: "Order Accepted", icon: "check-circle" },
  { status: "to_pickup", label: "En Route to Pickup", icon: "local-shipping" },
  { status: "arrived_pickup", label: "Arrived at Pickup", icon: "location-on" },
  { status: "picked_up", label: "Items Collected", icon: "inventory-2" },
  { status: "to_delivery", label: "En Route to Delivery", icon: "local-shipping" },
  { status: "arrived_delivery", label: "Arrived at Delivery", icon: "location-on" },
  { status: "delivered", label: "Delivered", icon: "check-circle" },
  { status: "cancelled", label: "Cancelled", icon: "cancel" },
];

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

function formatOrderItem(item: {
  productName: string;
  variationName?: string;
  quantity: number;
  unit: string;
  weightKg?: number;
}): string {
  const nameParts = [item.productName];
  if (item.variationName) nameParts.push(`(${item.variationName})`);
  const qty = item.weightKg ?? item.quantity;
  const unit = item.unit.toLowerCase() === "kg" ? "kg" : item.unit;
  return `${nameParts.join(" ")} - ${qty} ${unit}`;
}

function resolveFarmerName(pickup: {
  farmerName?: string;
  shopName?: string;
  businessName?: string;
  name?: string;
  farmName?: string;
}): string {
  return (
    pickup.farmerName ??
    pickup.shopName ??
    pickup.businessName ??
    pickup.name ??
    pickup.farmName ??
    "Farmer"
  );
}

export default function RiderOrderDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = id ? parseInt(id, 10) : 0;

  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Determine if this is a pre-accept preview (from Home/Available Orders)
  const isPreAccept = order?.status === "searching";

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await getRiderOrderById(orderId);
        if (!mounted) return;
        setOrder(data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Failed to load order details");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  const handleAccept = useCallback(async () => {
    if (!orderId || accepting) return;
    setAccepting(true);
    try {
      await acceptOrder(orderId);
      handleApiSuccess("Order Accepted", "The order is now yours to deliver.");
      router.replace({
        pathname: "/tabs/ActiveDeliveryPage",
        params: { orderId: String(orderId) },
      } as never);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (status === 422) {
        handleApiError(e, msg ?? "This order was just taken by another rider.");
      } else {
        handleApiError(e, "Could not accept the order. Please try again.");
      }
    } finally {
      setAccepting(false);
    }
  }, [orderId, router, accepting]);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, fontSize: 12, color: colors.textMuted }}>
              Loading order...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={styles.errorWrap}>
            <MaterialIcons name={IconTheme.alertCircle} size={40} color={colors.error} />
            <Text style={styles.errorTitle}>Could not load order</Text>
            <Text style={styles.errorDesc}>{error ?? "Order not found"}</Text>
            <Pressable style={styles.retryButton} onPress={() => router.back()}>
              <Text style={styles.retryButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const currentStatusIndex = STATUS_TIMELINE.findIndex((s) => s.status === order.status);
  const farmerName = resolveFarmerName(order.pickup);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            </Pressable>
            <Text style={styles.headerTitle}>Order Details</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Order Number & Status */}
          <View style={styles.orderHeader}>
            <Text style={styles.orderNumber}>Order {order.orderNumber}</Text>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor:
                    order.status === "delivered"
                      ? colors.success + "20"
                      : order.status === "cancelled"
                        ? colors.error + "20"
                        : colors.primary + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  {
                    color:
                      order.status === "delivered"
                        ? colors.success
                        : order.status === "cancelled"
                          ? colors.error
                          : colors.primary,
                  },
                ]}
              >
                {order.status.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Timeline */}
          <View style={styles.timelineSection}>
            <Text style={styles.sectionTitle}>Delivery Timeline</Text>
            <View style={styles.timeline}>
              {STATUS_TIMELINE.map((step, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                const isFuture = index > currentStatusIndex;

                return (
                  <View key={step.status} style={styles.timelineItem}>
                    <View style={styles.timelineLine}>
                      {index < STATUS_TIMELINE.length - 1 && (
                        <View
                          style={[
                            styles.timelineConnector,
                            isCompleted ? styles.timelineConnectorCompleted : null,
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.timelineDot,
                          isCompleted
                            ? styles.timelineDotCompleted
                            : isCurrent
                              ? styles.timelineDotCurrent
                              : styles.timelineDotFuture,
                        ]}
                      >
                        {isCompleted && (
                          <MaterialIcons
                            name="check"
                            size={12}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                    </View>
                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.timelineLabel,
                          isCurrent && styles.timelineLabelCurrent,
                          isFuture && styles.timelineLabelFuture,
                        ]}
                      >
                        {step.label}
                      </Text>
                      {isCurrent && (
                        <Text style={styles.timelineCurrentBadge}>CURRENT</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Fee & Earnings */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Earnings</Text>
            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsLabel}>Delivery Fee</Text>
                <Text style={styles.earningsValue}>₱{order.shippingFee.toFixed(2)}</Text>
              </View>
              {order.codAmount && order.codAmount > 0 && (
                <View style={styles.earningsItem}>
                  <Text style={styles.earningsLabel}>Cash on Delivery</Text>
                  <Text style={styles.earningsValue}>₱{order.codAmount.toFixed(2)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Pickup Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pickup Details</Text>
            <View style={styles.detailRow}>
              <MaterialIcons name={IconTheme.store} size={20} color={colors.primary} />
              <View style={styles.detailTextWrap}>
                <Text style={styles.detailLabel}>Seller</Text>
                <Text style={styles.detailValue}>{farmerName}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name={IconTheme.phone} size={20} color={colors.primary} />
              <View style={styles.detailTextWrap}>
                <Text style={styles.detailLabel}>Contact</Text>
                <Text style={styles.detailValue}>{order.pickup.farmerPhone}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name={IconTheme.mapMarkerOutline} size={20} color={colors.primary} />
              <View style={styles.detailTextWrap}>
                <Text style={styles.detailLabel}>Pickup Address</Text>
                <Text style={styles.detailValue}>
                  {[order.pickup.address.street, order.pickup.address.barangay, order.pickup.address.city, order.pickup.address.province]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            </View>
            {order.pickup.address.landmarkNote && (
              <View style={styles.detailRow}>
                <MaterialIcons name={IconTheme.location} size={20} color={colors.primary} />
                <View style={styles.detailTextWrap}>
                  <Text style={styles.detailLabel}>Landmark</Text>
                  <Text style={styles.detailValue}>{order.pickup.address.landmarkNote}</Text>
                </View>
              </View>
            )}

            {/* Items */}
            <Text style={[styles.cardTitle, { marginTop: 16 }]}>Items to Collect</Text>
            {order.pickup.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemText}>{formatOrderItem(item)}</Text>
              </View>
            ))}
          </View>

          {/* Delivery Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Details</Text>
            <View style={styles.detailRow}>
              <MaterialIcons name={IconTheme.user} size={20} color={colors.primary} />
              <View style={styles.detailTextWrap}>
                <Text style={styles.detailLabel}>Buyer</Text>
                <Text style={styles.detailValue}>{order.delivery.buyerName}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name={IconTheme.phone} size={20} color={colors.primary} />
              <View style={styles.detailTextWrap}>
                <Text style={styles.detailLabel}>Contact</Text>
                <Text style={styles.detailValue}>{order.delivery.buyerPhone}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name={IconTheme.mapMarkerOutline} size={20} color={colors.primary} />
              <View style={styles.detailTextWrap}>
                <Text style={styles.detailLabel}>Drop-off Address</Text>
                <Text style={styles.detailValue}>
                  {[order.delivery.address.street, order.delivery.address.barangay, order.delivery.address.city, order.delivery.address.province]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            </View>
            {order.delivery.noteToRider && (
              <View style={styles.detailRow}>
                <MaterialIcons name={IconTheme.message} size={20} color={colors.primary} />
                <View style={styles.detailTextWrap}>
                  <Text style={styles.detailLabel}>Note</Text>
                  <Text style={styles.detailValue}>{order.delivery.noteToRider}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Accept Order CTA (only for pre-accept from Home) */}
          {isPreAccept && (
            <Pressable
              style={[
                styles.acceptButton,
                accepting && styles.acceptButtonDisabled,
              ]}
              onPress={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.acceptButtonText}>ACCEPT ORDER</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scrollContent: {
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: "#1E1E1E",
    textAlign: "center",
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  orderNumber: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: "#1E1E1E",
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusChipText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  timelineSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: "#1E1E1E",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  timeline: {
    paddingHorizontal: 4,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 20,
  },
  timelineLine: {
    width: 28,
    alignItems: "center",
  },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: "#E0E0E0",
  },
  timelineConnectorCompleted: {
    backgroundColor: "#087434",
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineDotCompleted: {
    backgroundColor: "#087434",
    borderColor: "#087434",
  },
  timelineDotCurrent: {
    backgroundColor: "#FFFFFF",
    borderColor: "#087434",
    borderWidth: 3,
  },
  timelineDotFuture: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E0E0E0",
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
  },
  timelineLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: "#7A7A7A",
  },
  timelineLabelCurrent: {
    fontFamily: fontFamily.semiBold,
    color: "#087434",
  },
  timelineLabelFuture: {
    color: "#C4C4C4",
  },
  timelineCurrentBadge: {
    fontFamily: fontFamily.semiBold,
    fontSize: 8,
    color: "#087434",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: "#1E1E1E",
    marginBottom: 16,
  },
  earningsRow: {
    flexDirection: "row",
    gap: 16,
  },
  earningsItem: {
    flex: 1,
  },
  earningsLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: "#7A7A7A",
    marginBottom: 4,
  },
  earningsValue: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: "#087434",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  detailTextWrap: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: "#7A7A7A",
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: "#1E1E1E",
  },
  itemRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  itemText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: "#1E1E1E",
  },
  acceptButton: {
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#087434",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  errorTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: "#1E1E1E",
  },
  errorDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: "#7A7A7A",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#087434",
  },
  retryButtonText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
});