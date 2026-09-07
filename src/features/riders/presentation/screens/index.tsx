import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Switch,
    Text,
    View,
} from "react-native";

import { stylesFactory } from "@/features/riders/presentation/styles/index.styles";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import NativeMapView from "@/features/riders/presentation/components/NativeMapView";
import { useColors } from "@/hooks/useColors";
import { DEFAULT_MAP_CENTER } from "@/lib/mapTiles";
import { getRiderOrders } from "@/lib/riderOrdersApi";
import { getRiderSettings, updateRiderSettings } from "@/lib/riderSettingsApi";
import type { GeoPoint, RiderOrder } from "@/types/maps";

const BRAND_LOGO = require("@/assets/branding/sagana-wordform-logo.png");

/** Formats a PreciseAddress into a short label for the order card. */
function formatAddressShort(addr: {
  street: string;
  barangay: string;
  city: string;
}): string {
  return (
    [addr.street, addr.barangay, addr.city].filter(Boolean).join(", ") ||
    "Address pending"
  );
}

/** Formats a RiderOrder into the display shape used by the card component. */
function toOrderCard(order: RiderOrder, isActive: boolean) {
  return {
    id: String(order.orderId),
    orderId: order.orderId,
    amountLabel: `₱${order.shippingFee.toFixed(2)}`,
    recipientLabel: `${order.delivery.buyerName} ${order.delivery.buyerPhone}`,
    pickupLabel: order.pickup.farmerName,
    pickupDistanceLabel: formatAddressShort(order.pickup.address),
    dropoffLabel: formatAddressShort(order.delivery.address),
    dropoffDistanceLabel: order.delivery.noteToRider ?? "",
    isActive,
  };
}

type OrderCard = ReturnType<typeof toOrderCard>;

function DriverOrderCardView({ order }: { order: OrderCard }) {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const router = useRouter();
  const isActive = order.isActive;

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTopRow}>
        <Text style={styles.priceText}>{order.amountLabel}</Text>
      </View>

      <Text style={styles.recipientText}>{order.recipientLabel}</Text>

      <View style={styles.routeRow}>
        <View style={[styles.routeDot, styles.pickupDot]} />
        <View>
          <Text style={styles.routeMainText}>{order.pickupLabel}</Text>
          <Text style={styles.routeSubText}>{order.pickupDistanceLabel}</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={[styles.routeDot, styles.dropoffDot]} />
        <View>
          <Text style={styles.routeMainText}>{order.dropoffLabel}</Text>
          <Text style={styles.routeSubText}>{order.dropoffDistanceLabel}</Text>
        </View>
      </View>

      <Pressable
        style={styles.ctaRow}
        onPress={() =>
          router.push({
            pathname: "/tabs/(riders)/ActiveDeliveryPage",
            params: { orderId: String(order.orderId) },
          } as any)
        }
        accessibilityRole="button"
        accessibilityLabel={
          isActive ? "Open active delivery" : "View active order"
        }
      >
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
          >
            {isActive ? "ORDER IS ACTIVE" : "YOU HAVE AN ACTIVE ORDER"}
          </Text>
        </View>
        <View
          style={[
            styles.ctaArrowPill,
            isActive ? styles.ctaArrowPillActive : styles.ctaArrowPillInactive,
          ]}
        >
          <MaterialIcons
            name={IconTheme.chevronRight}
            size={14}
            color={colors.white}
          />
        </View>
      </Pressable>
    </View>
  );
}

export default function DriverHomepageScreen() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const router = useRouter();
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [activeOrder, setActiveOrder] = useState<RiderOrder | null>(null);
  const [availableOrders, setAvailableOrders] = useState<RiderOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Fetch rider settings on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await getRiderSettings();
        if (!mounted) return;
        setAutoAccept(settings.autoAccept);
        setIsOnDuty(settings.isOnline);
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
  }, []);

  // Fetch orders on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const allOrders = await getRiderOrders();
        if (!mounted) return;
        // Active order = any order in processing state
        const active =
          allOrders.find(
            (o) =>
              o.status === "to_pickup" ||
              o.status === "arrived_pickup" ||
              o.status === "picked_up" ||
              o.status === "to_delivery" ||
              o.status === "arrived_delivery",
          ) ?? null;
        // Available orders = searching/accepted (not yet started)
        const available = allOrders.filter(
          (o) => o.status === "searching" || o.status === "accepted",
        );
        setActiveOrder(active);
        setAvailableOrders(available);
      } catch (e) {
        if (__DEV__) {
          console.warn("[RiderHome] Failed to load orders:", e);
        }
      } finally {
        if (mounted) setIsLoadingOrders(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Toggle auto-accept
  const handleToggleAutoAccept = useCallback(async (value: boolean) => {
    setAutoAccept(value);
    try {
      await updateRiderSettings({ autoAccept: value });
    } catch (e) {
      if (__DEV__) {
        console.warn("[RiderHome] Failed to update auto-accept:", e);
      }
      setAutoAccept(!value);
    }
  }, []);

  // Toggle on-duty
  const handleToggleDuty = useCallback(async (value: boolean) => {
    setIsOnDuty(value);
    try {
      await updateRiderSettings({ isOnline: value });
    } catch (e) {
      if (__DEV__) {
        console.warn("[RiderHome] Failed to update online status:", e);
      }
      setIsOnDuty(!value);
    }
  }, []);

  // Destination for the mini-map — from active order or default center
  const mapDestination: GeoPoint = activeOrder
    ? {
        latitude: activeOrder.delivery.address.latitude,
        longitude: activeOrder.delivery.address.longitude,
      }
    : DEFAULT_MAP_CENTER;

  const activeCard = activeOrder ? toOrderCard(activeOrder, true) : null;
  const availableCards = availableOrders.map((o) => toOrderCard(o, false));

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Image
              source={BRAND_LOGO}
              style={styles.logo}
              contentFit="contain"
            />
            <View style={styles.dutyRow}>
              <Text style={styles.dutyLabel}>ON DUTY</Text>
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
              <View>
                <Text style={styles.autoAcceptTitle}>Auto-Accept Orders</Text>
                <Text style={styles.autoAcceptDesc}>
                  Automatically accept incoming delivery orders
                </Text>
              </View>
            </View>
            <Switch
              value={autoAccept}
              onValueChange={handleToggleAutoAccept}
              disabled={isLoadingSettings}
              trackColor={{ false: colors.border, true: "#6FB48E" }}
              thumbColor={autoAccept ? colors.success : colors.backgroundMuted}
              ios_backgroundColor={colors.border}
              style={styles.dutySwitch}
            />
          </View>

          <View style={styles.mapWrap}>
            {/* INTERACTIVE MAP — pinch zoom, pan, markers */}
            <NativeMapView
              route={null}
              riderLocation={null}
              riderHeading={null}
              destination={mapDestination}
              destinationType="delivery"
              isDarkMode={false}
            />

            <View style={styles.locateButton}>
              <MaterialIcons name="my-location" size={23} color="#0A6438" />
            </View>
          </View>

          <View style={styles.sheet}>
            <Text style={styles.sectionTitle}>Active Delivery</Text>
            {isLoadingOrders ? (
              <View style={styles.orderCard}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : activeCard ? (
              <DriverOrderCardView order={activeCard} />
            ) : (
              <View style={styles.orderCard}>
                <Text style={styles.routeSubText}>
                  No active delivery right now.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitleSecondary}>Available Orders</Text>
            {isLoadingOrders ? (
              <View style={styles.orderCard}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : availableCards.length > 0 ? (
              availableCards.map((card) => (
                <DriverOrderCardView key={card.id} order={card} />
              ))
            ) : (
              <View style={styles.orderCard}>
                <Text style={styles.routeSubText}>
                  No available orders right now.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
