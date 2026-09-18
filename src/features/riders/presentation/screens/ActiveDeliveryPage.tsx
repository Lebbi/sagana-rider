import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { styles } from "@/features/riders/presentation/styles/ActiveDeliveryPage.styles";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    Modal,
    PanResponder,
    Pressable,
    Text,
    useColorScheme,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// New map + navigation imports
import ETABadge from "@/features/riders/presentation/components/ETABadge";
import NativeMapView from "@/features/riders/presentation/components/NativeMapView";
import TurnByTurnCard from "@/features/riders/presentation/components/TurnByTurnCard";
import { useRiderNavigation } from "@/features/riders/presentation/hooks/useRiderNavigation";
import { DEFAULT_MAP_CENTER } from "@/lib/mapTiles";
import { getRiderOrderById, updateOrderStatus } from "@/lib/riderOrdersApi";
import { handleApiError, handleApiSuccess } from "@/utils/errorHandler";
import type { GeoPoint, RiderOrder } from "@/types/maps";

const SHEET_COLLAPSED_OFFSET = 380;
const SHEET_EXPANDED_OFFSET = 110;
const DRAG_DISMISS_THRESHOLD = 64;

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
  const hasCompletedPhaseOneRef = useRef(false);

  // Proof photos: base64 strings sent to backend on status update.
  // Pickup photo is required before the checklist auto-completes.
  // Delivery photo is required before "Mark as Delivered" is enabled.
  const [pickupPhoto, setPickupPhoto] = useState<string | null>(null);
  const [deliveryPhoto, setDeliveryPhoto] = useState<string | null>(null);

  // Fetch order from API
  useEffect(() => {
    if (!numericOrderId) return;
    setIsLoading(true);
    getRiderOrderById(numericOrderId)
      .then((fetched) => {
        setOrder(fetched);
        setCheckedItems(fetched.pickup.items.map(() => false));
        // Set phase from the order's actual delivery_status:
        // Phase 1 (pickup) = accepted, to_pickup, arrived_pickup
        // Phase 2 (delivery) = picked_up, to_delivery, arrived_delivery
        const pickupStatuses = ["accepted", "to_pickup", "arrived_pickup"];
        if (!pickupStatuses.includes(fetched.status)) {
          setActivePhase(2);
          hasCompletedPhaseOneRef.current = true;
        }
      })
      .catch((e) => {
        if (__DEV__) console.warn("[ActiveDelivery] Failed to fetch order:", e);
      })
      .finally(() => setIsLoading(false));
  }, [numericOrderId]);

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

  // Start GPS tracking on mount
  useEffect(() => {
    nav.startNavigation();
    return () => nav.stopNavigation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const translateY = useRef(new Animated.Value(SHEET_COLLAPSED_OFFSET)).current;
  const dragStartYRef = useRef(SHEET_COLLAPSED_OFFSET);

  const allItemsChecked = useMemo(
    () => checkedItems.every(Boolean),
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
        await updateOrderStatus(numericOrderId, "picked_up", pickupPhoto);
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
  }, [activePhase, allItemsChecked, numericOrderId]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          translateY.stopAnimation((currentValue: number) => {
            dragStartYRef.current = currentValue;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextValue = dragStartYRef.current + gesture.dy;
          const clamped = Math.max(
            SHEET_EXPANDED_OFFSET,
            Math.min(SHEET_COLLAPSED_OFFSET, nextValue),
          );
          translateY.setValue(clamped);
        },
        onPanResponderRelease: (_, gesture) => {
          const currentValue = dragStartYRef.current + gesture.dy;
          const isDraggingUp = gesture.dy < -DRAG_DISMISS_THRESHOLD;
          const snapTo = isDraggingUp
            ? SHEET_EXPANDED_OFFSET
            : SHEET_COLLAPSED_OFFSET;
          const clamped = Math.max(
            SHEET_EXPANDED_OFFSET,
            Math.min(SHEET_COLLAPSED_OFFSET, currentValue),
          );

          Animated.timing(translateY, {
            toValue:
              Math.abs(gesture.dy) > DRAG_DISMISS_THRESHOLD ? snapTo : clamped,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start(() => {
            if (Math.abs(gesture.dy) <= DRAG_DISMISS_THRESHOLD) {
              const nearest =
                Math.abs(clamped - SHEET_EXPANDED_OFFSET) <
                Math.abs(clamped - SHEET_COLLAPSED_OFFSET)
                  ? SHEET_EXPANDED_OFFSET
                  : SHEET_COLLAPSED_OFFSET;
              Animated.timing(translateY, {
                toValue: nearest,
                duration: 150,
                useNativeDriver: false,
              }).start();
            }
          });
        },
      }),
    [translateY],
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (photo) setDeliveryPhoto(photo);
  }, [takePhoto]);

  // Mark the order delivered — requires a delivery proof photo.
  // The backend allows milestone skips and credits the rider wallet
  // exactly once (idempotency-guarded). The photo is sent as proof.
  const handleMarkDelivered = useCallback(async () => {
    if (!deliveryPhoto) return;
    setIsSyncingStatus(true);
    try {
      await updateOrderStatus(numericOrderId, "delivered", deliveryPhoto);
      handleApiSuccess(
        "Delivery Complete",
        "Earnings have been added to your wallet.",
      );
      router.replace("/tabs/RiderOrdersPage" as never);
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
  }, [numericOrderId, router]);

  const isPhaseOne = activePhase === 1;
  const headerName = isPhaseOne
    ? (order?.pickup.farmerName ?? "Farmer")
    : (order?.delivery.buyerName ?? "Buyer");
  const headerNumber = isPhaseOne
    ? (order?.pickup.farmerPhone ?? "")
    : (order?.delivery.buyerPhone ?? "");
  const headerAvatar = isPhaseOne
    ? (order?.pickup.farmerPhoto ?? undefined)
    : (order?.delivery.buyerPhoto ?? undefined);

  // Loading state — show spinner before the order data arrives
  if (isLoading || !order) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#087434" />
            <Text style={{ marginTop: 12, fontSize: 12, color: "#7A7A7A" }}>
              Loading order...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.mapArea}>
          {/* LIVE MAP — replaces static PNG */}
          <NativeMapView
            route={nav.route}
            riderLocation={nav.riderLocation}
            riderHeading={nav.riderHeading}
            destination={
              destination ?? { latitude: 15.0319, longitude: 120.6894 }
            }
            destinationType={activePhase === 1 ? "pickup" : "delivery"}
            isDarkMode={isDarkMode}
          />

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
            </View>
            <View style={styles.topBarActions}>
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
        >
          <View style={styles.sheetHandleArea} {...panResponder.panHandlers}>
            <View style={styles.sheetHandle} />
          </View>

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
                {order?.pickup.farmerName ?? "Farmer"}
              </Text>
              <View style={styles.locationRow}>
                <MaterialIcons
                  name={IconTheme.mapMarkerOutline}
                  size={10}
                  color="#1E1E1E"
                />
                <Text style={styles.baseText}>
                  {isPhaseOne
                    ? [
                        order?.pickup.address.street,
                        order?.pickup.address.barangay,
                        order?.pickup.address.city,
                        order?.pickup.address.province,
                      ]
                        .filter(Boolean)
                        .join(", ")
                    : [
                        order?.delivery.address.street,
                        order?.delivery.address.barangay,
                        order?.delivery.address.city,
                        order?.delivery.address.province,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>ITEMS TO COLLECT</Text>
              <View style={styles.checkboxGroup}>
                {(order?.pickup.items ?? []).map((item, index) => {
                  const itemLabel = `${item.productName}${item.variationName ? `, ${item.variationName}` : ""}, ${item.quantity} ${item.unit}${item.weightKg ? `, ${item.weightKg} kg` : ""}`;
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
                            ? ("checkbox-marked" as any)
                            : ("checkbox-blank-outline" as any)
                        }
                        size={14}
                        color={checkedItems[index] ? "#087434" : "#C4C4C4"}
                      />
                      <Text style={styles.baseText}>{itemLabel}</Text>
                    </Pressable>
                  );
                })}
              </View>

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

              {pickupPhoto && (
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
              )}

              {!pickupPhoto && allItemsChecked && (
                <Text
                  style={{
                    fontSize: 9,
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
                {order?.delivery.buyerName ?? "Buyer"}
              </Text>
              <View style={styles.locationRow}>
                <MaterialIcons
                  name={IconTheme.mapMarkerOutline}
                  size={10}
                  color="#1E1E1E"
                />
                <Text style={styles.baseText}>
                  {[
                    order?.delivery.address.street,
                    order?.delivery.address.barangay,
                    order?.delivery.address.city,
                    order?.delivery.address.province,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>

              {order?.delivery.noteToRider ? (
                <Text style={styles.baseText}>
                  {order.delivery.noteToRider}
                </Text>
              ) : null}

              <Pressable
                style={[
                  styles.captureButton,
                  styles.captureButtonCompact,
                  deliveryPhoto ? { opacity: 0.5 } : null,
                ]}
                onPress={handleTakeDeliveryPhoto}
                accessibilityRole="button"
                accessibilityLabel="Take photo of delivered package"
              >
                <MaterialIcons
                  name={deliveryPhoto ? IconTheme.checkCircle : IconTheme.camera}
                  size={20}
                  color="#087434"
                />
                <Text style={styles.captureButtonText}>
                  {deliveryPhoto ? "DELIVERY PHOTO TAKEN" : "TAKE PHOTO OF DELIVERY"}
                </Text>
              </Pressable>

              {deliveryPhoto && (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${deliveryPhoto}` }}
                  style={{
                    width: "100%",
                    height: 120,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                  contentFit="cover"
                />
              )}

              {!deliveryPhoto && (
                <Text
                  style={{
                    fontSize: 9,
                    color: "#ba1a1a",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  Take a photo of the delivered package first.
                </Text>
              )}

              <Pressable
                style={[
                  styles.captureButton,
                  styles.captureButtonCompact,
                  !deliveryPhoto ? { opacity: 0.4 } : null,
                ]}
                onPress={handleMarkDelivered}
                disabled={isSyncingStatus || !deliveryPhoto}
                accessibilityRole="button"
                accessibilityLabel="Mark order as delivered"
              >
                {isSyncingStatus ? (
                  <ActivityIndicator size="small" color="#087434" />
                ) : (
                  <>
                    <MaterialIcons
                      name={IconTheme.checkCircle}
                      size={20}
                      color="#087434"
                    />
                    <Text style={styles.captureButtonText}>
                      MARK AS DELIVERED
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
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
    </View>
  );
}
