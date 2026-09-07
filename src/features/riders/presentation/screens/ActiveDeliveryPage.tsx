import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { styles } from "@/features/riders/presentation/styles/ActiveDeliveryPage.styles";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { getRiderOrderById } from "@/lib/riderOrdersApi";
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
  const hasCompletedPhaseOneRef = useRef(false);

  // Fetch order from API
  useEffect(() => {
    if (!numericOrderId) return;
    setIsLoading(true);
    getRiderOrderById(numericOrderId)
      .then((fetched) => {
        setOrder(fetched);
        setCheckedItems(fetched.pickup.items.map(() => false));
      })
      .catch(() => {})
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

  // For testing: skip Phase 1 and go straight to delivery (Phase 2)
  // so we can show rider → SM Pampanga route
  useEffect(() => {
    if (
      !allItemsChecked ||
      activePhase !== 1 ||
      hasCompletedPhaseOneRef.current
    )
      return;
    hasCompletedPhaseOneRef.current = true;
    setShowPhaseTransition(true);

    const timeoutId = setTimeout(() => {
      setShowPhaseTransition(false);
      setActivePhase(2);
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [activePhase, allItemsChecked]);

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

  const isPhaseOne = activePhase === 1;
  const headerName = isPhaseOne
    ? (order?.pickup.farmerName ?? "Jerome Bognot")
    : (order?.delivery.buyerName ?? "Megan Calalahani");
  const headerNumber = isPhaseOne
    ? (order?.pickup.farmerPhone ?? "")
    : (order?.delivery.buyerPhone ?? "");
  const headerAvatar = isPhaseOne
    ? (order?.pickup.farmerPhoto ?? undefined)
    : (order?.delivery.buyerPhoto ?? undefined);

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
              <Text style={styles.mainTargetName}>Bognot&rsquo;s Farm</Text>
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

              <Pressable style={styles.captureButton}>
                <MaterialIcons
                  name={IconTheme.camera}
                  size={20}
                  color="#087434"
                />
                <Text style={styles.captureButtonText}>
                  TAKE PHOTO OF PRODUCE
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.sheetBody}>
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeText}>Current Delivery</Text>
              </View>
              <Text style={styles.mainTargetName}>Megan Calalahani</Text>
              <View style={styles.locationRow}>
                <MaterialIcons
                  name={IconTheme.mapMarkerOutline}
                  size={10}
                  color="#1E1E1E"
                />
                <Text style={styles.baseText}>
                  Mabini St. Brgy. Sto. Rosario, San Fernando, Pampanga
                </Text>
              </View>

              <Text style={styles.baseText}>
                {"Iwanan nyo nalang po sa red na gate"}
              </Text>

              <Pressable
                style={[styles.captureButton, styles.captureButtonCompact]}
              >
                <MaterialIcons
                  name={IconTheme.camera}
                  size={20}
                  color="#087434"
                />
                <Text style={styles.captureButtonText}>
                  TAKE PHOTO OF DELIVERY
                </Text>
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
