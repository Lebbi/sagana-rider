/**
 * src/features/riders/presentation/screens/PasabayNavigationScreen.tsx
 *
 * Multi-stop navigation screen for Pasabay (multi-drop) deliveries.
 *
 * Combines:
 *   - RiderNavigationWebView (live map with route + rider marker)
 *   - StopProgressCard (Stop X of Y, next stop info)
 *   - TurnByTurnCard (next turn instruction)
 *   - Bottom sheet with items for the current stop + confirm button
 *
 * When the rider confirms a stop (pickup or delivery), the screen
 * advances to the next stop in the optimized batch.
 *
 * @see docs/maps-implementation-plan.md
 */

import { scale, verticalScale } from "@/constants/DesignSystem";
import { fontFamily } from "@/constants/FontTheme";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import RiderNavigationWebView from "@/features/riders/presentation/components/RiderNavigationWebView";
import StopProgressCard from "@/features/riders/presentation/components/StopProgressCard";
import TurnByTurnCard from "@/features/riders/presentation/components/TurnByTurnCard";
import { useRiderNavigation } from "@/features/riders/presentation/hooks/useRiderNavigation";
import { useColors } from "@/hooks/useColors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { getRiderOrders } from "@/lib/riderOrdersApi";
import { optimizeRoute } from "@/lib/routingApi";
import type { OptimizedStop, PasabayBatch } from "@/types/maps";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
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

// ============================================================
// Pasabay constraints — max 3 orders × 2 stops = 6 stops
// ============================================================

const PASABAY_CONSTRAINTS = {
  maxStops: 6,
  maxDistanceKm: 30,
  maxDurationMinutes: 60,
};

// ============================================================
// Helpers
// ============================================================

function formatAddress(stop: OptimizedStop): string {
  const parts = [
    stop.address.street,
    stop.address.barangay,
    stop.address.city,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Address pending";
}

// ============================================================
// Screen
// ============================================================

export default function PasabayNavigationScreen() {
  const router = useRouter();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const { batchId } = useLocalSearchParams<{ batchId?: string }>();

  const [batch, setBatch] = useState<PasabayBatch | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmedStops, setConfirmedStops] = useState<Set<number>>(new Set());

  // Fetch optimized batch — get available orders, then optimize route
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 1. Get the rider's current GPS position as the start point
        let riderStart = { latitude: 15.0319, longitude: 120.6894 };
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            riderStart = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
          }
        } catch {
          // Fall back to default center if GPS unavailable
        }

        // 2. Fetch available orders from the API
        const availableOrders = await getRiderOrders("searching");

        if (!mounted) return;

        if (availableOrders.length === 0) {
          setError("No available orders to batch right now.");
          return;
        }

        // 3. Build the optimize request from real order data
        const optimizeRequest = {
          riderStart,
          orders: availableOrders.map((o) => ({
            orderId: o.orderId,
            pickup: {
              latitude: o.pickup.address.latitude,
              longitude: o.pickup.address.longitude,
            },
            delivery: {
              latitude: o.delivery.address.latitude,
              longitude: o.delivery.address.longitude,
            },
          })),
          constraints: PASABAY_CONSTRAINTS,
        };

        // 4. Call the backend to optimize the route
        const response = await optimizeRoute(optimizeRequest);
        if (!mounted) return;

        setBatch({
          batchId: response.batchId,
          riderId: 0,
          orders: availableOrders,
          optimizedStops: response.optimizedStops,
          totalDistance: response.totalDistance,
          totalDuration: response.totalDuration,
          totalEarnings: availableOrders.reduce(
            (sum, o) => sum + o.shippingFee,
            0,
          ),
        });
      } catch (e: any) {
        if (!mounted) return;
        if (__DEV__) {
          console.warn("[PasabayNav] Failed to fetch batch:", e);
        }
        setError(e?.message ?? "Failed to load delivery batch");
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [batchId]);

  const currentStop: OptimizedStop | null =
    batch?.optimizedStops[currentStopIndex] ?? null;

  // Navigation hook for the current stop
  const nav = useRiderNavigation({
    orderId: currentStop?.orderId ?? 0,
    destination: currentStop
      ? {
          latitude: currentStop.address.latitude,
          longitude: currentStop.address.longitude,
        }
      : { latitude: 15.0319, longitude: 120.6894 },
    destinationType: currentStop?.type ?? "pickup",
  });

  // Start GPS tracking on mount
  useEffect(() => {
    nav.startNavigation();
    return () => nav.stopNavigation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle confirming the current stop
  const handleConfirmStop = useCallback(() => {
    if (!currentStop || !batch) return;

    setConfirmedStops((prev) => new Set(prev).add(currentStop.stopNumber));

    // Advance to next stop
    if (currentStopIndex < batch.optimizedStops.length - 1) {
      setCurrentStopIndex((prev) => prev + 1);
    } else {
      // All stops completed — navigate back
      if (__DEV__) {
        console.log("[PasabayNav] All stops completed!");
      }
      router.replace("/tabs/RiderOrdersPage" as never);
    }
  }, [currentStop, batch, currentStopIndex, router]);

  // Loading state
  if (isLoading) {
    return (
      <View
        style={[styles.loadingScreen, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Optimizing delivery route...
        </Text>
      </View>
    );
  }

  // Error state
  if (error || !batch || !currentStop) {
    return (
      <View
        style={[styles.errorScreen, { backgroundColor: colors.background }]}
      >
        <MaterialIcons
          name={IconTheme.alertCircle}
          size={48}
          color={colors.error}
        />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Could not load batch
        </Text>
        <Text style={[styles.errorDesc, { color: colors.textMuted }]}>
          {error ?? "No stops available"}
        </Text>
        <Pressable
          style={[styles.errorButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.errorButtonText, { color: colors.white }]}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const totalStops = batch.optimizedStops.length;
  const isPickup = currentStop.type === "pickup";
  const isConfirmed = confirmedStops.has(currentStop.stopNumber);
  const isLastStop = currentStopIndex === totalStops - 1;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        {/* Map area */}
        <View style={styles.mapArea}>
          <RiderNavigationWebView
            route={nav.route}
            riderLocation={nav.riderLocation}
            riderHeading={nav.riderHeading}
            destination={{
              latitude: currentStop.address.latitude,
              longitude: currentStop.address.longitude,
            }}
            destinationType={currentStop.type}
            isDarkMode={isDarkMode}
            onMapReady={() => {
              if (__DEV__) {
                console.log(
                  "[PasabayNav] Map ready for stop",
                  currentStopIndex + 1,
                );
              }
            }}
          />

          {/* Stop progress card overlay */}
          <View style={styles.stopCardOverlay}>
            <StopProgressCard
              currentStop={currentStopIndex + 1}
              totalStops={totalStops}
              nextStopAddress={formatAddress(currentStop)}
              nextStopContactName={currentStop.contactName}
              nextStopType={currentStop.type}
              etaMinutes={nav.etaMinutes}
              distanceKm={
                nav.route ? nav.route.totalDistance / 1000 : undefined
              }
            />
          </View>

          {/* Turn-by-turn overlay */}
          <View style={styles.turnByTurnOverlay}>
            <TurnByTurnCard
              currentStep={nav.currentStep}
              nextStep={nav.nextStep}
              distanceToNextStep={nav.distanceToNextStep}
              etaMinutes={nav.etaMinutes}
            />
          </View>
        </View>

        {/* Bottom sheet: items for current stop + confirm button */}
        <View style={[styles.bottomSheet, { backgroundColor: colors.card }]}>
          <View style={styles.sheetHandle} />
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Stop header */}
            <View style={styles.sheetHeader}>
              <MaterialIcons
                name={isPickup ? IconTheme.store : IconTheme.home}
                size={scale(24)}
                color={colors.primary}
              />
              <View style={styles.sheetHeaderText}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {isPickup ? "Pickup Items" : "Delivery Items"}
                </Text>
                <Text
                  style={[styles.sheetSubtitle, { color: colors.textMuted }]}
                >
                  Order #{currentStop.orderId} • Stop {currentStopIndex + 1} of{" "}
                  {totalStops}
                </Text>
              </View>
            </View>

            {/* Contact info */}
            <View
              style={[
                styles.contactCard,
                { backgroundColor: colors.backgroundMuted },
              ]}
            >
              <MaterialIcons
                name={IconTheme.personOutlineCircle}
                size={scale(18)}
                color={colors.primary}
              />
              <View style={styles.contactInfo}>
                <Text style={[styles.contactName, { color: colors.text }]}>
                  {currentStop.contactName}
                </Text>
                <Text
                  style={[styles.contactPhone, { color: colors.textMuted }]}
                >
                  {currentStop.contactPhone}
                </Text>
              </View>
              <Pressable
                style={[styles.callButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Call contact"
              >
                <MaterialIcons
                  name={IconTheme.phone}
                  size={scale(16)}
                  color={colors.white}
                />
              </Pressable>
            </View>

            {/* Items list */}
            <Text style={[styles.itemsLabel, { color: colors.text }]}>
              Items
            </Text>
            {currentStop.items.length > 0 ? (
              currentStop.items.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.itemRow,
                    { backgroundColor: colors.backgroundMuted },
                  ]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.productName}
                    </Text>
                    {item.variationName && (
                      <Text
                        style={[
                          styles.itemVariation,
                          { color: colors.textMuted },
                        ]}
                      >
                        {item.variationName}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.itemQty, { color: colors.primary }]}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyItems, { color: colors.textMuted }]}>
                No items to display for this stop.
              </Text>
            )}

            {/* Confirm button */}
            <Pressable
              style={[
                styles.confirmButton,
                {
                  backgroundColor: isConfirmed
                    ? colors.success
                    : colors.primary,
                },
              ]}
              onPress={handleConfirmStop}
              accessibilityRole="button"
              accessibilityLabel={
                isPickup ? "Confirm pickup" : "Confirm delivery"
              }
            >
              <MaterialIcons
                name={IconTheme.checkCircle}
                size={scale(20)}
                color={colors.white}
              />
              <Text style={styles.confirmButtonText}>
                {isConfirmed
                  ? "Confirmed — Advancing..."
                  : isLastStop
                    ? "Complete Final Stop"
                    : `Confirm ${isPickup ? "Pickup" : "Delivery"} & Next Stop`}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0C111B",
  },
  safeArea: {
    flex: 1,
  },
  mapArea: {
    flex: 1,
    overflow: "hidden",
    minHeight: 380,
  },
  stopCardOverlay: {
    position: "absolute",
    top: scale(12),
    left: scale(12),
    right: scale(12),
    zIndex: 10,
  },
  turnByTurnOverlay: {
    position: "absolute",
    bottom: scale(8),
    left: scale(12),
    right: scale(12),
    zIndex: 10,
  },
  bottomSheet: {
    maxHeight: 340,
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    overflow: "hidden",
  },
  sheetHandle: {
    width: scale(40),
    height: scale(4),
    backgroundColor: "#D0D0D0",
    borderRadius: scale(2),
    alignSelf: "center",
    marginTop: scale(10),
    marginBottom: scale(6),
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: scale(16),
    paddingBottom: scale(24),
    gap: verticalScale(10),
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    marginBottom: verticalScale(4),
  },
  sheetHeaderText: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: scale(18),
    fontFamily: fontFamily.bold,
  },
  sheetSubtitle: {
    fontSize: scale(13),
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    borderRadius: scale(12),
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: scale(14),
    fontFamily: fontFamily.semiBold,
  },
  contactPhone: {
    fontSize: scale(12),
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  callButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: "center",
    justifyContent: "center",
  },
  itemsLabel: {
    fontSize: scale(14),
    fontFamily: fontFamily.semiBold,
    marginTop: verticalScale(4),
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: scale(10),
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: scale(14),
    fontFamily: fontFamily.medium,
  },
  itemVariation: {
    fontSize: scale(12),
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  itemQty: {
    fontSize: scale(14),
    fontFamily: fontFamily.semiBold,
  },
  emptyItems: {
    fontSize: scale(13),
    fontFamily: fontFamily.regular,
    paddingVertical: scale(12),
    textAlign: "center",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    paddingVertical: verticalScale(16),
    borderRadius: scale(12),
    marginTop: verticalScale(8),
  },
  confirmButtonText: {
    fontSize: scale(16),
    fontFamily: fontFamily.semiBold,
    color: "#fff",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(12),
  },
  loadingText: {
    fontSize: scale(15),
    fontFamily: fontFamily.regular,
  },
  errorScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: scale(12),
    paddingHorizontal: scale(40),
  },
  errorTitle: {
    fontSize: scale(18),
    fontFamily: fontFamily.bold,
  },
  errorDesc: {
    fontSize: scale(14),
    fontFamily: fontFamily.regular,
    textAlign: "center",
  },
  errorButton: {
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(12),
    borderRadius: scale(12),
    marginTop: scale(8),
  },
  errorButtonText: {
    fontSize: scale(15),
    fontFamily: fontFamily.semiBold,
  },
});
