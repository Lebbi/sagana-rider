import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { styles } from "@/features/riders/presentation/styles/ActiveDeliveryPage.styles";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    GestureResponderEvent,
    Modal,
    PanResponder,
    Pressable,
    Text,
    useColorScheme,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// New map + navigation imports
import {
  MIN_STOP_GAP,
  SHEET_DEFAULT_OFFSET,
  SHEET_EXPANDED_OFFSET,
  getSheetStops,
} from "@/features/riders/presentation/utils/sheetStops";
import ETABadge from "@/features/riders/presentation/components/ETABadge";
import NativeMapView from "@/features/riders/presentation/components/NativeMapView";
import TurnByTurnCard from "@/features/riders/presentation/components/TurnByTurnCard";
import { useRiderNavigation } from "@/features/riders/presentation/hooks/useRiderNavigation";
import { DEFAULT_MAP_CENTER } from "@/lib/mapTiles";
import { cancelOrder, getRiderOrderById, getRiderOrders, updateOrderStatus } from "@/lib/riderOrdersApi";
import type { CancelReason } from "@/lib/riderOrdersApi";
import { showSaganaToast } from "@/components/ui/saganaToastConfig";
import { handleApiError, handleApiSuccess } from "@/utils/errorHandler";
import type { GeoPoint, RiderOrder } from "@/types/maps";

const removePhotoStyle = {
  position: "absolute" as const,
  top: 12,
  right: 4,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: "rgba(0,0,0,0.6)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const DRAG_DISMISS_THRESHOLD = 64;
const PEEK_HEIGHT_GUESS = 260;

const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: "vehicle_breakdown", label: "Vehicle Breakdown" },
  { value: "unreachable_contact", label: "Unreachable Farmer/Buyer" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];

/**
 * Formats an OrderItem for display: "Product Name - Quantity Unit"
 * e.g., "Ampalaya - 2 kg" or "Talom (Premium) - 10 kg"
 */
function formatOrderItem(item: { productName: string; variationName?: string; quantity: number; unit: string; weightKg?: number }): string {
  const nameParts = [item.productName];
  if (item.variationName) nameParts.push(`(${item.variationName})`);
  // Use weightKg if available (more precise), otherwise quantity
  const qty = item.weightKg ?? item.quantity;
  const unit = item.unit.toLowerCase() === "kg" ? "kg" : item.unit;
  return `${nameParts.join(" ")} - ${qty} ${unit}`;
}

/**
 * Resolves farmer/seller name with fallback chain per spec:
 * shop_name -> business_name -> name -> farm_name -> 'Farmer'
 * Handles both camelCase and snake_case from API.
 * Returns 'Farmer' if pickup is undefined or no name fields present.
 */
function resolveFarmerName(pickup?: { farmerName?: string; shopName?: string; businessName?: string; name?: string; farmName?: string }): string {
  if (!pickup) return "Farmer";
  return (
    pickup.farmerName
    ?? pickup.shopName
    ?? pickup.businessName
    ?? pickup.name
    ?? pickup.farmName
    ?? "Farmer"
  );
}

/**
 * Resolves pickup address with fallback.
 * Uses full address if available, otherwise barangay + city.
 * Returns "Address pending" if pickup is undefined or no address fields present.
 */
function resolvePickupAddress(pickup?: { address?: { street?: string; barangay?: string; city?: string; province?: string }; barangay?: string; city?: string }): string {
  if (!pickup) return "Address pending";
  const addr = pickup.address;
  if (addr && (addr.street || addr.barangay || addr.city || addr.province)) {
    return [addr.street, addr.barangay, addr.city, addr.province].filter(Boolean).join(", ");
  }
  // Fallback to seller-level barangay/city
  if (pickup.barangay || pickup.city) {
    return [pickup.barangay, pickup.city].filter(Boolean).join(", ");
  }
  return "Address pending";
}

function MapPinNote() {
  return (
    <Text style={{ fontSize: 10.8, color: "#ba1a1a", marginTop: 4 }}>
      Map pin not set. Confirm the exact address by phone before heading out.
    </Text>
  );
}

export default function ActiveDeliveryPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const numericOrderId = orderId ? parseInt(orderId, 10) : 0;

  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [activePhase, setActivePhase] = useState<1 | 2>(1);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState<CancelReason | "">("");
  const hasCompletedPhaseOneRef = useRef(false);
  const orderRef = useRef<RiderOrder | null>(null);

  // Proof photos: base64 strings sent to backend on status update.
  // Pickup photo is required before the checklist auto-completes.
  // Delivery photos: at least one required before "Mark as Delivered"
  // is enabled; rider can add more (displayed side-by-side).
  const [pickupPhoto, setPickupPhoto] = useState<string | null>(null);
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);

  // The tab screen stays mounted between orders, so every per-order value
  // must be reset whenever the loaded order changes or finishes.
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const loadOrder = useCallback((next: RiderOrder | null) => {
    const pickupStatuses = ["accepted", "to_pickup", "arrived_pickup"];
    const inPhaseTwo = !!next && !pickupStatuses.includes(next.status);
    setOrder(next);
    setCheckedItems(next ? next.pickup.items.map(() => false) : []);
    setActivePhase(inPhaseTwo ? 2 : 1);
    hasCompletedPhaseOneRef.current = inPhaseTwo;
    setPickupPhoto(null);
    setDeliveryPhotos([]);
  }, []);

  // When the Active tab is tapped without an orderId param (e.g. rider
  // taps the Active tab on the nav bar after accepting an order from Home),
  // fetch the rider's active orders from the API and load the first one.
  // Previously this just cleared state → "No Active Delivery" even when
  // the rider had an accepted/in-progress order.
  useFocusEffect(
    useCallback(() => {
      if (orderId) return; // orderId param present — useEffect handles it

      let mounted = true;
      setIsLoading(true);
      (async () => {
        try {
          const orders = await getRiderOrders();
          if (!mounted) return;
          const activeStatuses = [
            "accepted",
            "to_pickup",
            "arrived_pickup",
            "picked_up",
            "to_delivery",
            "arrived_delivery",
          ];
          const active = orders.find((o) => activeStatuses.includes(o.status));
          // Same order refetched on focus keeps the rider's in-progress photos.
          if (active?.orderId === orderRef.current?.orderId && active?.status === orderRef.current?.status) return;
          loadOrder(active ?? null);
        } catch (e) {
          if (__DEV__) console.warn("[ActiveDelivery] Failed to fetch active order:", e);
          // Network failure — keep whatever state we had rather than
          // rendering the empty state. A rider with a live delivery must
          // never see "No Active Delivery" because one fetch failed.
          // Next focus retries.
        } finally {
          if (mounted) setIsLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [orderId, loadOrder]),
  );

  // Fetch order from API — retry up to 3 times with 500ms delay because
  // the accept endpoint may not have committed the rider_id assignment
  // by the time we navigate here (race condition between acceptOrder
  // completing and ActiveDeliveryPage mounting).
  // If numericOrderId is 0 (tab switch lost the param), don't fetch —
  // the empty-state UI will show instead of an infinite spinner.
  useEffect(() => {
    if (!numericOrderId) {
      setIsLoading(false);
      return;
    }
    loadOrder(null);
    setIsLoading(true);
    let cancelled = false;
    let attempt = 0;

    const fetchWithRetry = async () => {
      while (attempt < 3) {
        attempt++;
        try {
          const fetched = await getRiderOrderById(numericOrderId);
          if (cancelled) return;
          // If the order is already delivered/cancelled, don't show it —
          // the rider already completed this delivery. Show empty state.
          if (fetched.status === "delivered" || fetched.status === "cancelled") {
            loadOrder(null);
            return;
          }
          loadOrder(fetched);
          return;
        } catch (e: any) {
          if (__DEV__)
            console.warn(
              `[ActiveDelivery] Fetch attempt ${attempt} failed:`,
              e?.response?.status,
            );
          if (attempt < 3) await new Promise((r) => setTimeout(r, 500));
        }
      }
      if (!cancelled && __DEV__)
        console.warn("[ActiveDelivery] All fetch retries failed");
    };

    fetchWithRetry().finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [numericOrderId, loadOrder]);

  // Determine destination based on phase
  const destination: GeoPoint | null = useMemo(() => {
    if (!order) return null;
    const addr =
      activePhase === 1 ? order.pickup.address : order.delivery.address;
    return { latitude: addr.latitude, longitude: addr.longitude };
  }, [order, activePhase]);

  // Start navigation hook
  const nav = useRiderNavigation({
    orderId: numericOrderId,
    destination: destination ?? DEFAULT_MAP_CENTER,
    destinationType: activePhase === 1 ? "pickup" : "delivery",
  });

  // Start GPS tracking + route fetching only after the order loads
  // (destination is null until getRiderOrderById succeeds). Starting
  // before that sends a routing request to DEFAULT_MAP_CENTER — wasted
  // bandwidth and confusing logs.
  useEffect(() => {
    if (!order) return;
    nav.startNavigation();
    return () => nav.stopNavigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const translateY = useRef(new Animated.Value(SHEET_DEFAULT_OFFSET)).current;
  const dragStartYRef = useRef(SHEET_DEFAULT_OFFSET);

  const [isSheetLowered, setIsSheetLowered] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [peekHeight, setPeekHeight] = useState(PEEK_HEIGHT_GUESS);

  const animateSheetTo = useCallback(
    (toValue: number) =>
      Animated.timing(translateY, {
        toValue,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(),
    [translateY],
  );

  // Lowest stop: the sheet top sits so only the handle + checklist/photo show.
  const insets = useSafeAreaInsets();
  const peekOffset = Math.max(
    SHEET_EXPANDED_OFFSET + MIN_STOP_GAP,
    sheetHeight - peekHeight,
  );
  const peekOffsetRef = useRef(peekOffset);
  peekOffsetRef.current = peekOffset;

  useEffect(() => {
    if (isSheetLowered && sheetHeight > 0) animateSheetTo(peekOffset);
  }, [isSheetLowered, sheetHeight, peekOffset, animateSheetTo]);

  const loadedOrderId = order?.orderId;
  useEffect(() => {
    setIsSheetLowered(false);
    animateSheetTo(SHEET_DEFAULT_OFFSET);
  }, [loadedOrderId, animateSheetTo]);

  const handleMapPress = useCallback(() => {
    setIsSheetLowered(true);
    animateSheetTo(peekOffsetRef.current);
  }, [animateSheetTo]);

  // The map's own onPress is not delivered by every map implementation (the
  // tile fallback has none), so a short, near-stationary touch on the map
  // wrapper counts as a tap.
  const mapTouchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const handleMapTouchStart = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY, touches } = e.nativeEvent;
    mapTouchRef.current =
      touches.length === 1 ? { x: pageX, y: pageY, t: Date.now() } : null;
  }, []);
  const handleMapTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      const start = mapTouchRef.current;
      mapTouchRef.current = null;
      if (!start) return;
      const { pageX, pageY } = e.nativeEvent;
      const moved = Math.hypot(pageX - start.x, pageY - start.y);
      if (moved < 10 && Date.now() - start.t < 400) handleMapPress();
    },
    [handleMapPress],
  );

  const allItemsChecked = useMemo(
    () => checkedItems.length > 0 && checkedItems.every(Boolean),
    [checkedItems],
  );

  // All items checked + pickup photo taken → sync pickup completion to
  // the backend (picked_up), then run the visual phase transition to
  // Phase 2. The photo is sent as proof. On sync failure the checklist
  // stays usable and the error is surfaced via toast.
  useEffect(() => {
    if (
      !allItemsChecked ||
      !pickupPhoto ||
      activePhase !== 1 ||
      hasCompletedPhaseOneRef.current
    )
      return;
    hasCompletedPhaseOneRef.current = true;

    const syncPickupComplete = async () => {
      setIsSyncingStatus(true);
      try {
        const orderId = order?.orderId ?? numericOrderId;
        await updateOrderStatus(orderId, "picked_up", pickupPhoto);
        // Rider now heads to the buyer: farmer screen flips to In Transit.
        // Best effort — pickup is already saved and "delivered" may skip this step.
        updateOrderStatus(orderId, "to_delivery").catch(() => {});
        setShowPhaseTransition(true);
        setTimeout(() => {
          setShowPhaseTransition(false);
          setActivePhase(2);
        }, 1200);
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = e?.response?.data?.message;
        handleApiError(
          e,
          status === 422
            ? msg ?? "Could not mark items as collected. Try again."
            : "Could not save your progress. Check your connection and re-check the items.",
        );
        hasCompletedPhaseOneRef.current = false;
      } finally {
        setIsSyncingStatus(false);
      }
    };

    syncPickupComplete();
  }, [activePhase, allItemsChecked, pickupPhoto, numericOrderId, order]);

  // Surface a Sagana toast when location is off or could not be fetched,
  // so the rider is not left looking at a silent destination-only map.
  // Tapping the toast opens system settings to re-enable location.
  useEffect(() => {
    if (nav.locationStatus === "denied" || nav.locationStatus === "failed") {
      showSaganaToast({
        type: "error",
        text1:
          nav.locationStatus === "denied"
            ? "Location is off"
            : "Couldn’t get your location",
        text2:
          nav.locationStatus === "denied"
            ? "Turn it on to see your route and ETA."
            : "Tap to check settings.",
        actionHint: "Open settings",
        onPress: () => Linking.openSettings(),
      });
    }
  }, [nav.locationStatus]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Taps stay with the buttons and checkboxes; only a vertical drag takes over.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          translateY.stopAnimation((currentValue: number) => {
            dragStartYRef.current = currentValue;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextValue = dragStartYRef.current + gesture.dy;
          translateY.setValue(
            Math.max(
              SHEET_EXPANDED_OFFSET,
              Math.min(peekOffsetRef.current, nextValue),
            ),
          );
        },
        onPanResponderRelease: (_, gesture) => {
          const stops = getSheetStops(peekOffsetRef.current);
          const current = dragStartYRef.current + gesture.dy;
          const nearest = stops.reduce((a, b) =>
            Math.abs(b - current) < Math.abs(a - current) ? b : a,
          );
          // A decisive flick moves one stop in its direction.
          const from = stops.reduce((a, b) =>
            Math.abs(b - dragStartYRef.current) <
            Math.abs(a - dragStartYRef.current)
              ? b
              : a,
          );
          const fromIdx = stops.indexOf(from);
          const target =
            gesture.dy > DRAG_DISMISS_THRESHOLD
              ? stops[Math.min(stops.length - 1, fromIdx + 1)]
              : gesture.dy < -DRAG_DISMISS_THRESHOLD
                ? stops[Math.max(0, fromIdx - 1)]
                : nearest;

          setIsSheetLowered(target === peekOffsetRef.current);
          animateSheetTo(target);
        },
      }),
    [translateY, animateSheetTo],
  );

  const handleToggleItem = (itemIndex: number) => {
    if (activePhase !== 1) return;
    setCheckedItems((previous) =>
      previous.map((itemValue, index) =>
        index === itemIndex ? !itemValue : itemValue,
      ),
    );
  };

  // Launch camera and return base64 (or null if cancelled/failed).
  const takePhoto = useCallback(async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      handleApiError(
        new Error("Camera permission denied"),
        "Camera access is needed to take proof photos.",
      );
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;
    return result.assets[0].base64;
  }, []);

  const handleTakePickupPhoto = useCallback(async () => {
    const photo = await takePhoto();
    if (photo) setPickupPhoto(photo);
  }, [takePhoto]);

  const handleTakeDeliveryPhoto = useCallback(async () => {
    const photo = await takePhoto();
    if (photo) setDeliveryPhotos((prev) => [...prev, photo]);
  }, [takePhoto]);

  // Mark the order delivered — requires at least one delivery proof photo.
  // The backend allows milestone skips and credits the rider wallet
  // exactly once (idempotency-guarded). The first photo is sent as proof.
  const handleMarkDelivered = useCallback(async () => {
    if (deliveryPhotos.length === 0) return;
    const id = order?.orderId ?? numericOrderId;
    if (!id) return;
    setIsSyncingStatus(true);
    try {
      await updateOrderStatus(id, "delivered", deliveryPhotos[0]);
      handleApiSuccess(
        "Delivery Complete",
        "Earnings have been added to your wallet.",
      );
      loadOrder(null);
      router.replace("/tabs" as never);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      handleApiError(
        e,
        status === 422
          ? msg ?? "Could not complete the delivery. Try again."
          : "Could not save the delivery. Check your connection and try again.",
      );
    } finally {
      setIsSyncingStatus(false);
    }
  }, [numericOrderId, router, deliveryPhotos, order, loadOrder]);

  // Cancel delivery — calls backend to cancel/unassign, resets rider to available
  const handleCancelDelivery = useCallback(async () => {
    if (!selectedCancelReason || !order) return;
    const id = order.orderId;
    setIsSyncingStatus(true);
    try {
      await cancelOrder(id, selectedCancelReason as CancelReason);
      handleApiSuccess(
        "Delivery Cancelled",
        "The order has been released back to the available pool.",
      );
      setShowCancelModal(false);
      setSelectedCancelReason("");
      loadOrder(null);
      router.replace("/tabs" as never);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      handleApiError(
        e,
        status === 422
          ? msg ?? "Could not cancel the delivery. Try again."
          : "Could not cancel the delivery. Check your connection and try again.",
      );
    } finally {
      setIsSyncingStatus(false);
    }
  }, [order, router, selectedCancelReason, loadOrder]);

  // Loading state — show spinner only while fetching
  if (isLoading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#087434" />
            <Text style={{ marginTop: 12, fontSize: 14.4, color: "#7A7A7A" }}>
              Loading order...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Empty state — no active order (either no orderId param from tab
  // switch, or the order was already delivered/cancelled)
  if (!order) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
            <MaterialIcons name="check-circle-outline" size={64} color="#087434" />
            <Text style={{ marginTop: 16, fontSize: 19.2, fontWeight: "600", color: "#1B1B1B", textAlign: "center" }}>
              No Active Delivery
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14.4, color: "#7A7A7A", textAlign: "center" }}>
              Accept an order from the Home tab to start a delivery.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // These run AFTER early returns — order is guaranteed non-null here
  const isPhaseOne = activePhase === 1;
  const mapPinMissing = (isPhaseOne ? order.pickup.address : order.delivery.address)
    .coordinatesMissing;
  const headerName = isPhaseOne
    ? resolveFarmerName(order.pickup)
    : (order.delivery.buyerName ?? "Buyer");
  const headerNumber = isPhaseOne
    ? (order.pickup.farmerPhone ?? "")
    : (order.delivery.buyerPhone ?? "");
  const headerAvatar = isPhaseOne
    ? (order.pickup.farmerPhoto ?? undefined)
    : (order.delivery.buyerPhoto ?? undefined);

  const itemsChecklist = (
    <>
              <Text style={styles.sectionLabel}>ITEMS TO COLLECT</Text>
              <View style={styles.checkboxGroup}>
                {(order?.pickup.items ?? []).map((item, index) => {
                  const itemLabel = formatOrderItem(item);
                  return (
                    <Pressable
                      key={index}
                      style={styles.checkboxRow}
                      onPress={() => handleToggleItem(index)}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: checkedItems[index],
                        disabled: activePhase !== 1,
                      }}
                      accessibilityLabel={`Mark item collected: ${itemLabel}`}
                    >
                      <MaterialIcons
                        name={
                          checkedItems[index]
                            ? "check-box"
                            : "check-box-outline-blank"
                        }
                        size={14}
                        color={checkedItems[index] ? "#087434" : "#C4C4C4"}
                      />
                      <Text style={styles.baseText}>{itemLabel}</Text>
                    </Pressable>
                  );
                })}
              </View>
    </>
  );
  const pickupPhotoButton = (
              <Pressable
                style={[
                  styles.captureButton,
                  styles.captureButtonCompact,
                  pickupPhoto ? { opacity: 0.5 } : null,
                ]}
                onPress={handleTakePickupPhoto}
                accessibilityRole="button"
                accessibilityLabel="Take photo of produce at pickup"
              >
                <MaterialIcons
                  name={pickupPhoto ? IconTheme.checkCircle : IconTheme.camera}
                  size={20}
                  color="#087434"
                />
                <Text style={styles.captureButtonText}>
                  {pickupPhoto ? "PRODUCE PHOTO TAKEN" : "TAKE PHOTO OF PRODUCE"}
                </Text>
              </Pressable>
  );
  const deliveryPhotoButton = (
              <Pressable
                style={[
                  styles.captureButton,
                  styles.captureButtonCompact,
                  deliveryPhotos.length > 0 ? { opacity: 0.5 } : null,
                ]}
                onPress={handleTakeDeliveryPhoto}
                accessibilityRole="button"
                accessibilityLabel="Take photo of delivered package"
              >
                <MaterialIcons
                  name={
                    deliveryPhotos.length > 0
                      ? IconTheme.checkCircle
                      : IconTheme.camera
                  }
                  size={20}
                  color="#087434"
                />
                <Text style={styles.captureButtonText}>
                  {deliveryPhotos.length > 0
                    ? "DELIVERY PHOTO TAKEN"
                    : "TAKE PHOTO OF DELIVERY"}
                </Text>
              </Pressable>
  );
  const markDeliveredButton = (
              <Pressable
                style={[
                  styles.captureButton,
                  styles.captureButtonCompact,
                  deliveryPhotos.length === 0
                    ? { opacity: 0.4, backgroundColor: "#DCDCDC" }
                    : { backgroundColor: "#087434" },
                ]}
                onPress={handleMarkDelivered}
                disabled={isSyncingStatus || deliveryPhotos.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Mark order as delivered"
              >
                {isSyncingStatus ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons
                      name={IconTheme.checkCircle}
                      size={20}
                      color={deliveryPhotos.length > 0 ? "#FFFFFF" : "#7A7A7A"}
                    />
                    <Text
                      style={[
                        styles.captureButtonText,
                        {
                          color: deliveryPhotos.length > 0 ? "#FFFFFF" : "#7A7A7A",
                        },
                      ]}
                    >
                      MARK AS DELIVERED
                    </Text>
                  </>
                )}
              </Pressable>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <View style={[styles.statusBarStrip, { height: insets.top }]} />
        <View style={styles.mapArea}>
          {/* LIVE MAP — replaces static PNG */}
          <View
            style={{ flex: 1 }}
            onTouchStart={handleMapTouchStart}
            onTouchEnd={handleMapTouchEnd}
          >
          <NativeMapView
            route={nav.route}
            riderLocation={nav.riderLocation}
            riderHeading={nav.riderHeading}
            destination={
              destination ?? { latitude: 15.0319, longitude: 120.6894 }
            }
            destinationType={activePhase === 1 ? "pickup" : "delivery"}
            isDarkMode={isDarkMode}
            onPress={handleMapPress}
          />
          </View>

          {/* ETA badge overlay */}
          <View style={styles.etaBadgeOverlay}>
            <ETABadge
              minutes={nav.etaMinutes}
              distanceKm={(nav.route?.totalDistance ?? 0) / 1000}
              isNavigating={!!nav.riderLocation}
            />
          </View>

          {/* Turn-by-turn card overlay */}
          <View style={styles.turnByTurnOverlay}>
            <TurnByTurnCard
              currentStep={nav.currentStep}
              nextStep={nav.nextStep}
              distanceToNextStep={nav.distanceToNextStep}
              etaMinutes={nav.etaMinutes}
            />
          </View>

          <View style={styles.topBar}>
            <Pressable
              style={[styles.headerActionButton, { marginRight: 4 }]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back to home"
            >
              <MaterialIcons name="arrow-back" size={21} color="#087434" />
            </Pressable>
            <Image
              source={{ uri: headerAvatar }}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.topBarTextWrap}>
              <Text style={styles.topBarName}>{headerName}</Text>
              <Text style={styles.topBarNumber}>{headerNumber}</Text>
              <Text style={styles.topBarNumber}>Order {order?.orderNumber}</Text>
            </View>
            <View style={styles.topBarActions}>
              {isPhaseOne && (
                <Pressable
                  style={styles.headerActionButton}
                  onPress={() => setShowCancelModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel delivery"
                >
                  <MaterialIcons
                    name={IconTheme.closeCircle}
                    size={21}
                    color="#BA1A1A"
                  />
                </Pressable>
              )}
              <Pressable style={styles.headerActionButton}>
                <MaterialIcons
                  name={IconTheme.phone}
                  size={21}
                  color="#087434"
                />
              </Pressable>
              <Pressable
                style={styles.headerActionButton}
                onPress={() => {
                  // In-app chat with farmer/buyer is not available in the
                  // rider app v1 — the phone button above is the contact path.
                }}
                accessibilityRole="button"
                accessibilityLabel="Messages unavailable"
              >
                <MaterialIcons
                  name={IconTheme.message}
                  size={20}
                  color="#C4C4C4"
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.mapRightControls}>
            <Pressable style={styles.mapControlButton}>
              <MaterialIcons
                name={IconTheme.volumeUp as any}
                size={28}
                color="#FFFFFF"
              />
            </Pressable>
            <Pressable
              style={styles.mapControlButton}
              onPress={nav.reroute}
              accessibilityRole="button"
              accessibilityLabel="Recenter map"
            >
              <MaterialIcons
                name={IconTheme.compass}
                size={25}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </View>

        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY }],
            },
          ]}
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          {...panResponder.panHandlers}
        >
          <View
            onLayout={(e) => {
              if (isSheetLowered) setPeekHeight(e.nativeEvent.layout.height);
            }}
          >
          <View style={styles.sheetHandleArea}>
            <View style={styles.sheetHandle} />
          </View>

          {isSheetLowered ? (
            <View style={[styles.sheetBody, { paddingBottom: 16 + insets.bottom }]}>
              {isPhaseOne ? (
                <>
                  {itemsChecklist}
                  {pickupPhotoButton}
                </>
              ) : (
                <>
                  {deliveryPhotoButton}
                  {markDeliveredButton}
                </>
              )}
            </View>
          ) : (
          <>
          <View style={styles.phasePillRow}>
            <View
              style={[
                styles.phasePill,
                isPhaseOne ? styles.phasePillActive : styles.phasePillInactive,
              ]}
            >
              <Text
                style={[
                  styles.phasePillText,
                  isPhaseOne ? styles.phasePillTextActive : null,
                ]}
              >
                Phase 1: Going to Farmer
              </Text>
            </View>
            <View
              style={[
                styles.phasePill,
                !isPhaseOne ? styles.phasePillActive : styles.phasePillInactive,
              ]}
            >
              <Text
                style={[
                  styles.phasePillText,
                  !isPhaseOne ? styles.phasePillTextActive : null,
                ]}
              >
                Phase 2: Going to Buyer
              </Text>
            </View>
          </View>

          {isPhaseOne ? (
            <View style={styles.sheetBody}>
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeText}>Current Pickup</Text>
              </View>
              <Text style={styles.mainTargetName}>
                {resolveFarmerName(order.pickup)}
              </Text>
              <View style={styles.locationRow}>
                <MaterialIcons
                  name={IconTheme.mapMarkerOutline}
                  size={10}
                  color="#1E1E1E"
                />
                <Text style={styles.baseText}>
                  {isPhaseOne
                    ? resolvePickupAddress(order.pickup)
                    : [
                        order.delivery.address.street,
                        order.delivery.address.barangay,
                        order.delivery.address.city,
                        order.delivery.address.province,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                </Text>
              </View>

              {mapPinMissing && <MapPinNote />}

              {itemsChecklist}

              {pickupPhotoButton}

              {pickupPhoto && (
                <View>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${pickupPhoto}` }}
                    style={{
                      width: "100%",
                      height: 120,
                      borderRadius: 8,
                      marginTop: 8,
                    }}
                    contentFit="cover"
                  />
                  <Pressable
                    style={removePhotoStyle}
                    onPress={() => setPickupPhoto(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove pickup photo"
                  >
                    <MaterialIcons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

              {!pickupPhoto && allItemsChecked && (
                <Text
                  style={{
                    fontSize: 10.8,
                    color: "#ba1a1a",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  Take a photo of the produce to complete pickup.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.sheetBody}>
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeText}>Current Delivery</Text>
              </View>
              <Text style={styles.mainTargetName}>
                {order.delivery.buyerName ?? "Buyer"}
              </Text>
              <View style={styles.locationRow}>
                <MaterialIcons
                  name={IconTheme.mapMarkerOutline}
                  size={10}
                  color="#1E1E1E"
                />
                <Text style={styles.baseText}>
                  {[
                    order.delivery.address.street,
                    order.delivery.address.barangay,
                    order.delivery.address.city,
                    order.delivery.address.province,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>

              {mapPinMissing && <MapPinNote />}

              {order.delivery.noteToRider ? (
                <Text style={styles.baseText}>
                  {order.delivery.noteToRider}
                </Text>
              ) : null}

              {deliveryPhotoButton}

              {deliveryPhotos.length > 0 && (
                <>
                  {/* Thumbnails in one row, side by side */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    {deliveryPhotos.map((photo, index) => (
                      <View key={index} style={{ flex: 1 }}>
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${photo}` }}
                          style={{ height: 90, borderRadius: 8 }}
                          contentFit="cover"
                        />
                        <Pressable
                          style={removePhotoStyle}
                          onPress={() =>
                            setDeliveryPhotos((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel="Remove delivery photo"
                        >
                          <MaterialIcons name="close" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  {/* Add another photo — compact secondary button */}
                  <Pressable
                    style={{
                      marginTop: 8,
                      minHeight: 36,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#087434",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 6,
                    }}
                    onPress={handleTakeDeliveryPhoto}
                    accessibilityRole="button"
                    accessibilityLabel="Add another delivery photo"
                  >
                    <MaterialIcons name="add-a-photo" size={16} color="#087434" />
                    <Text
                      style={{
                        fontFamily: "StackSansHeadline_700Bold",
                        fontSize: 9.6,
                        color: "#087434",
                        letterSpacing: 0.5,
                      }}
                    >
                      ADD ANOTHER PHOTO
                    </Text>
                  </Pressable>
                </>
              )}

              {!deliveryPhotos.length && (
                <Text
                  style={{
                    fontSize: 10.8,
                    color: "#ba1a1a",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  Take a photo of the delivered package first.
                </Text>
              )}

              {markDeliveredButton}
            </View>
          )}
          </>
          )}
          </View>
        </Animated.View>
      </SafeAreaView>

      <Modal
        visible={showPhaseTransition}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.phaseTransitionOverlay}>
          <View style={styles.phaseTransitionCard}>
            <ActivityIndicator size="small" color="#087434" />
            <Text style={styles.phaseTransitionText}>Phase 1 complete</Text>
          </View>
        </View>
      </Modal>

      {/* Syncing overlay — shown during picked_up / delivered PATCH */}
      <Modal
        visible={isSyncingStatus && !showPhaseTransition}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.phaseTransitionOverlay}>
          <View style={styles.phaseTransitionCard}>
            <ActivityIndicator size="small" color="#087434" />
            <Text style={styles.phaseTransitionText}>
              {activePhase === 1 ? "Completing pickup..." : "Completing delivery..."}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Cancel Delivery Confirmation Modal */}
      <Modal
        visible={showCancelModal && isPhaseOne}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.cancelModalOverlay}>
          <View style={styles.cancelModalCard}>
            <Text style={styles.cancelModalTitle}>Cancel Delivery?</Text>
            <Text style={styles.cancelModalSubtitle}>
              Select a reason for cancelling this delivery:
            </Text>
            <View style={styles.cancelReasonList}>
              {CANCEL_REASONS.map((reason) => (
                <Pressable
                  key={reason.value}
                  style={[
                    styles.cancelReasonItem,
                    selectedCancelReason === reason.value
                      ? styles.cancelReasonItemSelected
                      : null,
                  ]}
                  onPress={() => setSelectedCancelReason(reason.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedCancelReason === reason.value }}
                >
                  <View
                    style={[
                      styles.cancelReasonRadio,
                      selectedCancelReason === reason.value
                        ? styles.cancelReasonRadioSelected
                        : null,
                    ]}
                  />
                  <Text style={styles.cancelReasonLabel}>{reason.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.cancelModalButtons}>
              <Pressable
                style={styles.cancelModalButtonSecondary}
                onPress={() => {
                  setShowCancelModal(false);
                  setSelectedCancelReason("");
                }}
                disabled={isSyncingStatus}
              >
                <Text style={styles.cancelModalButtonTextSecondary}>Back</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.cancelModalButtonPrimary,
                  !selectedCancelReason || isSyncingStatus
                    ? styles.cancelModalButtonDisabled
                    : null,
                ]}
                onPress={handleCancelDelivery}
                disabled={!selectedCancelReason || isSyncingStatus}
              >
                {isSyncingStatus ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.cancelModalButtonTextPrimary}>
                    Confirm Cancel
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
