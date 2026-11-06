import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    AppState,
    Pressable,
    RefreshControl,
    ScrollView,
    Switch,
    Text,
    View,
} from "react-native";

import { stylesFactory } from "@/features/riders/presentation/styles/index.styles";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useAutoAccept } from "@/context/AutoAcceptContext";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import NativeMapView from "@/features/riders/presentation/components/NativeMapView";
import { useColors } from "@/hooks/useColors";
import { t, useT } from "@/lib/i18n";
import { DEFAULT_MAP_CENTER } from "@/lib/mapTiles";
import { acceptOrder, getRiderOrders } from "@/lib/riderOrdersApi";
import { getRiderSettings, updateRiderSettings } from "@/lib/riderSettingsApi";
import { handleApiError, handleApiSuccess } from "@/utils/errorHandler";
import type { GeoPoint, RiderOrder } from "@/types/maps";
import { useRiderLocation, calculateDistance } from "@/features/riders/presentation/hooks/useRiderLocation";
import OrderPreviewSheet from "@/features/riders/presentation/components/OrderPreviewSheet";
import { getOrderCardRoute } from "@/features/riders/presentation/utils/orderNavigation";

const BRAND_LOGO = require("@/assets/branding/sagana-wordform-logo.png");

export const ORDER_POLL_MS = 12_000;

/** Formats a PreciseAddress into a short label for the order card. */
function formatAddressShort(addr: {
  street: string;
  barangay: string;
  city: string;
  province: string;
  coordinatesMissing?: boolean;
}): string {
  const text =
    [addr.street, addr.barangay, addr.city, addr.province]
      .filter(Boolean)
      .join(", ") || t("common.addressPending");
  return addr.coordinatesMissing ? t("home.pinNotSet", { address: text }) : text;
}

/** Formats a RiderOrder into the display shape used by the card component. */
function toOrderCard(order: RiderOrder, isActive: boolean, riderLoc?: GeoPoint) {
  const pickupDistance = riderLoc && order.pickup.address.latitude && order.pickup.address.longitude
    ? calculateDistance(riderLoc, {
        latitude: order.pickup.address.latitude,
        longitude: order.pickup.address.longitude,
      })
    : null;
  const dropoffDistance = riderLoc && order.delivery.address.latitude && order.delivery.address.longitude
    ? calculateDistance(riderLoc, {
        latitude: order.delivery.address.latitude,
        longitude: order.delivery.address.longitude,
      })
    : null;

  return {
    id: String(order.orderId),
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    amountLabel: `₱${order.shippingFee.toFixed(2)}`,
    recipientLabel: `${order.delivery.buyerName} ${order.delivery.buyerPhone}`,
    pickupLabel: order.pickup.farmerName,
    pickupDistanceLabel: formatAddressShort(order.pickup.address),
    pickupDistance,
    dropoffLabel: formatAddressShort(order.delivery.address),
    dropoffDistance,
    dropoffDistanceLabel: order.delivery.noteToRider ?? "",
    isActive,
    status: order.status,
  };
}

type OrderCard = ReturnType<typeof toOrderCard>;

function DriverOrderCardView({
  order,
  onAccept,
  onPreview,
  acceptInFlight,
}: {
  order: OrderCard;
  onAccept: (orderId: number) => void;
  onPreview: (orderId: number) => void;
  acceptInFlight: boolean;
}) {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const router = useRouter();
  const t = useT();
  const isActive = order.isActive;
  const isAvailable = order.status === "searching";

  const handleCardPress = () => {
    if (isAvailable) {
      onPreview(order.orderId);
      return;
    }
    router.push(getOrderCardRoute(order) as never);
  };

  return (
    <Pressable style={styles.orderCard} onPress={handleCardPress} accessibilityRole="button">
      <View style={styles.orderTopRow}>
        <Text style={styles.priceText}>{order.amountLabel}</Text>
      </View>

      <Text style={styles.recipientText}>{order.recipientLabel}</Text>
      <Text style={styles.routeSubText}>{t("common.orderNumber", { number: order.orderNumber })}</Text>

      <View style={styles.routeRow}>
        <View style={[styles.routeDot, styles.pickupDot]} />
        <View>
          <Text style={styles.routeMainText}>{order.pickupLabel}</Text>
          <View style={styles.distanceRow}>
            <Text style={styles.routeSubText}>{order.pickupDistanceLabel}</Text>
            {order.pickupDistance !== null && order.pickupDistance !== undefined && (
              <Text style={styles.distanceText}>
                {order.pickupDistance < 1000
                  ? t("home.metersAway", { distance: Math.round(order.pickupDistance) })
                  : t("home.kmAway", { distance: (order.pickupDistance / 1000).toFixed(1) })}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={[styles.routeDot, styles.dropoffDot]} />
        <View>
          <Text style={styles.routeMainText}>{order.dropoffLabel}</Text>
          <View style={styles.distanceRow}>
            <Text style={styles.routeSubText}>{order.dropoffDistanceLabel}</Text>
            {order.dropoffDistance !== null && order.dropoffDistance !== undefined && (
              <Text style={styles.distanceText}>
                {order.dropoffDistance < 1000
                  ? t("home.metersAway", { distance: Math.round(order.dropoffDistance) })
                  : t("home.kmAway", { distance: (order.dropoffDistance / 1000).toFixed(1) })}
              </Text>
            )}
          </View>
        </View>
      </View>

      {isAvailable ? (
        <View style={styles.ctaRow}>
          <Pressable
            style={[styles.ctaPill, styles.ctaPillActive]}
            onPress={(e) => {
              e.stopPropagation();
              onAccept(order.orderId);
            }}
            disabled={acceptInFlight}
            accessibilityRole="button"
            accessibilityLabel={t("home.acceptOrderA11y", { number: order.orderNumber })}
          >
            {acceptInFlight ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.ctaTextActive} numberOfLines={1} adjustsFontSizeToFit>{t("orderDetails.acceptCta")}</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.ctaRow}>
          <View
            style={[
              styles.ctaPill,
              isActive ? styles.ctaPillActive : styles.ctaPillInactive,
            ]}
          >
            <Text
              style={[
                styles.ctaText,
                isActive ? styles.ctaTextActive : styles.ctaTextInactive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {isActive ? t("home.orderActive") : t("home.youHaveActive")}
            </Text>
          </View>
          <View
            style={[
              styles.ctaArrowPill,
              isActive
                ? styles.ctaArrowPillActive
                : styles.ctaArrowPillInactive,
            ]}
          >
            <MaterialIcons
              name={IconTheme.chevronRight}
              size={14}
              color={colors.white}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function DriverHomepageScreen() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  // Auto-accept + duty state now lives in AutoAcceptProvider so the
  // engine (mounted at tabs layout) reads the same values the rider
  // toggles here.
  const {
    autoAcceptEnabled,
    setAutoAcceptEnabled,
    isOnline: isOnDuty,
    setIsOnline,
    phase: autoAcceptPhase,
  } = useAutoAccept();

  // Rider location for order distance filtering
  const { location: riderLocation, refreshLocation } = useRiderLocation();
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [activeOrder, setActiveOrder] = useState<RiderOrder | null>(null);
  const [availableOrders, setAvailableOrders] = useState<RiderOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [acceptingOrderId, setAcceptingOrderId] = useState<number | null>(null);
  const [previewOrderId, setPreviewOrderId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch orders (also used to refresh after accept)
  const fetchOrders = useCallback(async () => {
    try {
      const allOrders = await getRiderOrders();
      // Active order = accepted or any in-progress state
      const active =
        allOrders.find(
          (o) =>
            o.status === "accepted" ||
            o.status === "to_pickup" ||
            o.status === "arrived_pickup" ||
            o.status === "picked_up" ||
            o.status === "to_delivery" ||
            o.status === "arrived_delivery",
        ) ?? null;
      // Available orders = searching only (not yet accepted by anyone)
      const available = allOrders.filter(
        (o) => o.status === "searching",
      );

      setActiveOrder(active);
      setAvailableOrders(available);
    } catch (e: any) {
      console.error('[RiderHome] Failed to load orders:', e?.message, e?.response?.status, e?.response?.data);
      if (__DEV__) {
        console.warn("[RiderHome] Failed to load orders:", e);
      }
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchOrders();
      await refreshLocation();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchOrders, refreshLocation]);

  // Fetch rider settings on mount — sync into the shared context so the
  // auto-accept engine picks them up. Then fetch orders with correct isOnDuty.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await getRiderSettings();
        if (!mounted) return;
        setAutoAcceptEnabled(settings.autoAccept);
        setIsOnline(settings.isOnline);
        // Fetch orders AFTER settings are loaded so isOnDuty is correct for backend filtering
        await fetchOrders();
      } catch (e) {
        if (__DEV__) {
          console.warn("[RiderHome] Failed to load settings:", e);
        }
      } finally {
        if (mounted) setIsLoadingSettings(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setAutoAcceptEnabled, setIsOnline, fetchOrders]);

  // While Home is focused: fetch now, every ORDER_POLL_MS while the app is in
  // the foreground, and again when it returns to the foreground (no Reverb).
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      const timer = setInterval(() => {
        if (AppState.currentState === "active") fetchOrders();
      }, ORDER_POLL_MS);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") fetchOrders();
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [fetchOrders]),
  );

  // Also refetch when on-duty status changes (e.g., rider toggles the switch)
  useEffect(() => {
    if (!isLoadingSettings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch when duty status changes; fetchOrders only sets loading flags
      fetchOrders();
    }
  }, [isOnDuty, isLoadingSettings, fetchOrders]);

  // Debug: Log auto-accept phase changes to understand order disappearance
  useEffect(() => {
    console.log('[RiderHome] Auto-accept phase:', autoAcceptPhase, '| isOnDuty:', isOnDuty, '| autoAcceptEnabled:', autoAcceptEnabled);
  }, [autoAcceptPhase, isOnDuty, autoAcceptEnabled]);

  // Accept an available order — assigns it to this rider and moves it to
  // the active column after the refresh.
  const handleAcceptOrder = useCallback(
    async (orderId: number) => {
      setAcceptingOrderId(orderId);
      try {
        await acceptOrder(orderId);
        setPreviewOrderId(null);
        handleApiSuccess(t("status.accepted"), t("orderDetails.acceptedBody"));
        await fetchOrders();
        // Navigate to Active Delivery immediately so the rider sees the
        // order details instead of having to tap the Active card manually.
        router.push({
          pathname: "/tabs/ActiveDeliveryPage",
          params: { orderId: String(orderId) },
        } as never);
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = e?.response?.data?.message;
        if (status === 422) {
          handleApiError(
            e,
            msg ?? t("orderDetails.taken"),
          );
        } else {
          handleApiError(e, t("orderDetails.acceptFailed"));
        }
        setPreviewOrderId(null);
        await fetchOrders();
      } finally {
        setAcceptingOrderId(null);
      }
    },
    [fetchOrders, router],
  );

  // Toggle auto-accept — persist to backend; context state drives the engine
  const handleToggleAutoAccept = useCallback(
    async (value: boolean) => {
      setAutoAcceptEnabled(value);
      try {
        await updateRiderSettings({ autoAccept: value });
        // Refetch orders - backend behavior may change with auto-accept setting
        await fetchOrders();
      } catch (e) {
        if (__DEV__) {
          console.warn("[RiderHome] Failed to update auto-accept:", e);
        }
        setAutoAcceptEnabled(!value);
      }
    },
    [setAutoAcceptEnabled, fetchOrders],
  );

  // Toggle on-duty — persist to backend; context state drives the engine
  const handleToggleDuty = useCallback(
    async (value: boolean) => {
      setIsOnline(value);
      try {
        await updateRiderSettings({ isOnline: value });
        // Refetch orders when duty status changes - backend may show/hide searching orders
        await fetchOrders();
      } catch (e) {
        if (__DEV__) {
          console.warn("[RiderHome] Failed to update online status:", e);
        }
        setIsOnline(!value);
      }
    },
    [setIsOnline, fetchOrders],
  );

  // Destination for the mini-map — from the active order, or null when idle.
  // Center on the rider's live GPS when idle (fallback to the service-area
  // default if no fix yet), and on the delivery destination when on a delivery.
  const mapDestination: GeoPoint | null = activeOrder
    ? {
        latitude: activeOrder.delivery.address.latitude,
        longitude: activeOrder.delivery.address.longitude,
      }
    : null;
  // Center on the delivery when on a delivery, otherwise on the rider's
  // live GPS (falling back to the service-area default until a fix arrives).
  const mapCenter: GeoPoint = mapDestination ?? riderLocation ?? DEFAULT_MAP_CENTER;

  const availablePins: GeoPoint[] = availableOrders
    .map((o) => o.pickup.address)
    .filter((a) => !a.coordinatesMissing)
    .map((a) => ({ latitude: a.latitude, longitude: a.longitude }));

  const previewOrder = availableOrders.find((o) => o.orderId === previewOrderId) ?? null;
  const activeCard = activeOrder ? toOrderCard(activeOrder, true, riderLocation ?? undefined) : null;
  const availableCards = availableOrders
    .map((o) => toOrderCard(o, false, riderLocation ?? undefined))
    .sort((a, b) => {
      // Sort by pickup distance, closest first. Unknown distances sink to the end.
      const aD = a.pickupDistance ?? Infinity;
      const bD = b.pickupDistance ?? Infinity;
      return aD - bD;
    });

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <Image
              source={BRAND_LOGO}
              style={styles.logo}
              contentFit="contain"
            />
            <View style={styles.dutyRow}>
              <Text style={styles.dutyLabel}>{t("home.onDuty")}</Text>
              <Switch
                value={isOnDuty}
                onValueChange={handleToggleDuty}
                disabled={isLoadingSettings}
                trackColor={{ false: colors.border, true: "#6FB48E" }}
                thumbColor={isOnDuty ? colors.success : colors.backgroundMuted}
                ios_backgroundColor={colors.border}
                style={styles.dutySwitch}
              />
            </View>
          </View>

          {/* Auto-accept toggle */}
          <View style={styles.autoAcceptRow}>
            <View style={styles.autoAcceptInfo}>
              <MaterialIcons
                name={IconTheme.flash}
                size={20}
                color={colors.primary}
              />
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.autoAcceptTitle}>{t("home.autoAcceptTitle")}</Text>
                <Text style={styles.autoAcceptDesc}>
                  {autoAcceptPhase === "countdown"
                    ? t("home.autoAccepting")
                    : autoAcceptPhase === "scanning" && autoAcceptEnabled && isOnDuty
                      ? t("home.autoScanning")
                      : t("home.autoAcceptDesc")}
                </Text>
              </View>
            </View>
            <Switch
              value={autoAcceptEnabled}
              onValueChange={handleToggleAutoAccept}
              disabled={isLoadingSettings}
              trackColor={{ false: colors.border, true: "#6FB48E" }}
              thumbColor={autoAcceptEnabled ? colors.success : colors.backgroundMuted}
              ios_backgroundColor={colors.border}
              style={styles.dutySwitch}
            />
          </View>

          <View style={styles.mapWrap}>
            {/* INTERACTIVE MAP — pinch zoom, pan, markers */}
            <NativeMapView
              route={null}
              riderLocation={riderLocation ?? null}
              riderHeading={null}
              destination={mapDestination}
              destinationType="delivery"
              center={mapCenter}
              areaPins={availablePins}
              isDarkMode={false}
            />

            <View style={styles.locateButton}>
              <MaterialIcons name="my-location" size={23} color="#0A6438" />
            </View>
          </View>

          <View style={styles.sheet}>
            <Text style={styles.sectionTitle}>{t("home.activeDelivery")}</Text>
            {isLoadingOrders ? (
              <View style={styles.orderCard}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : activeCard ? (
              <DriverOrderCardView
                order={activeCard}
                onAccept={handleAcceptOrder}
                onPreview={setPreviewOrderId}
                acceptInFlight={acceptingOrderId === activeCard.orderId}
              />
            ) : (
              <View style={styles.orderCard}>
                <Text style={styles.routeSubText}>
                  {t("home.noActive")}
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitleSecondary}>{t("home.availableOrders")}</Text>
            {isLoadingOrders ? (
              <View style={styles.orderCard}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : availableCards.length > 0 ? (
              availableCards.map((card) => (
                <DriverOrderCardView
                  key={card.id}
                  order={card}
                  onAccept={handleAcceptOrder}
                  onPreview={setPreviewOrderId}
                  acceptInFlight={acceptingOrderId === card.orderId}
                />
              ))
            ) : (
              <View style={styles.orderCard}>
                <Text style={styles.routeSubText}>
                  {t("home.noAvailable")}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      {previewOrder && (
        <OrderPreviewSheet
          order={previewOrder}
          riderLocation={riderLocation ?? null}
          accepting={acceptingOrderId === previewOrder.orderId}
          onAccept={handleAcceptOrder}
          onClose={() => setPreviewOrderId(null)}
        />
      )}
    </View>
  );
}
