import { MaterialIcons } from "@/constants/IconTheme";
import { fontFamily } from "@/constants/FontTheme";
import NativeMapView from "@/features/riders/presentation/components/NativeMapView";
import { getPreviewStops } from "@/features/riders/presentation/utils/orderPreview";
import { t, useT } from "@/lib/i18n";
import { getDirections } from "@/lib/routingApi";
import type { GeoPoint, OrderItem, PreciseAddress, RiderOrder, RouteResponse } from "@/types/maps";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GREEN = "#087434";
const PICKUP = "#396B5C";
const DELIVERY = "#E53935";
const INK = "#141414";
const MUTED = "#6B6B6B";

function addressLine(a: PreciseAddress): string {
  const text = [a.street, a.barangay, a.city].filter(Boolean).join(", ") || t("preview.addressPending");
  return a.coordinatesMissing ? t("preview.pinNotSet", { address: text }) : text;
}

function itemLine(i: OrderItem): string {
  const name = i.variationName ? `${i.productName} (${i.variationName})` : i.productName;
  return `${name}  ${i.weightKg ?? i.quantity} ${i.unit}`;
}

function km(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

function StopRow({
  color,
  title,
  address,
  distance,
  last,
}: {
  color: string;
  title: string;
  address: string;
  distance?: string;
  last?: boolean;
}) {
  return (
    <View style={styles.stopRow}>
      <View style={styles.spine}>
        <View style={[styles.stopDot, { backgroundColor: color }]} />
        {!last && <View style={styles.spineLine} />}
      </View>
      <View style={styles.stopText}>
        <Text style={styles.stopTitle}>{title}</Text>
        <Text style={styles.stopAddress}>{address}</Text>
      </View>
      {distance ? <Text style={styles.stopDistance}>{distance}</Text> : null}
    </View>
  );
}

export default function OrderPreviewSheet({
  order,
  riderLocation,
  accepting,
  onAccept,
  onClose,
}: {
  order: RiderOrder;
  riderLocation: GeoPoint | null;
  accepting: boolean;
  onAccept: (orderId: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const isDarkMode = useColorScheme() === "dark";
  const { pickup, delivery, legs } = useMemo(
    () => getPreviewStops(order, riderLocation),
    [order, riderLocation],
  );

  // Round the key so GPS jitter does not refetch the route on every fix.
  const routeKey = legs.length
    ? legs
        .map(({ request: r }) =>
          [r.origin, r.destination]
            .map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`)
            .join(">"),
        )
        .join("|")
    : null;
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [legMeters, setLegMeters] = useState<number[]>([]);
  const [routeState, setRouteState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!legs.length) {
      setRoute(null);
      setLegMeters([]);
      setRouteState("unavailable");
      return;
    }
    let cancelled = false;
    setRouteState("loading");
    Promise.all(legs.map((l) => getDirections(l.request)))
      .then((results) => {
        if (cancelled) return;
        setLegMeters(results.map((r) => r.totalDistance));
        setRoute({
          polyline: results.flatMap((r) => r.polyline),
          totalDistance: results.reduce((n, r) => n + r.totalDistance, 0),
          totalDuration: results.reduce((n, r) => n + r.totalDuration, 0),
          steps: results.flatMap((r) => r.steps),
          legs: results.flatMap((r) => r.legs),
        });
        setRouteState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setRoute(null);
        setRouteState("unavailable");
      });
    return () => {
      cancelled = true;
    };
    // routeKey stands in for legs, which are rebuilt on every GPS fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  const toFarmer = legMeters[legs.findIndex((l) => l.to === "farmer")];
  const toBuyer = legMeters[legs.findIndex((l) => l.to === "buyer")];

  const destination = delivery ?? pickup;
  const extraStops = pickup && delivery ? [{ point: pickup, type: "pickup" as const }] : undefined;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <View style={styles.map}>
          <NativeMapView
            route={route}
            riderLocation={riderLocation}
            riderHeading={null}
            destination={destination}
            destinationType={delivery ? "delivery" : "pickup"}
            extraStops={extraStops}
            isDarkMode={isDarkMode}
          />
          {routeState === "unavailable" && (
            <View style={[styles.mapNote, { top: insets.top + 64 }]}>
              <Text style={styles.mapNoteText}>
                {legs.length ? t("preview.routeUnavailable") : t("preview.noPin")}
              </Text>
            </View>
          )}
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("preview.close")}
          >
            <MaterialIcons name="close" size={24} color={INK} />
          </Pressable>
        </View>

        <View style={[styles.panel, { paddingBottom: 16 + insets.bottom }]}>
          <Text style={styles.stopAddress}>{t("common.orderNumber", { number: order.orderNumber })}</Text>
          <View style={styles.panelHeader}>
            <Text style={styles.fare}>{`₱${order.shippingFee.toFixed(2)}`}</Text>
            {routeState === "loading" ? (
              <ActivityIndicator size="small" color={GREEN} />
            ) : route ? (
              <Text style={styles.total}>
                {`${km(route.totalDistance)}, ${Math.max(1, Math.round(route.totalDuration / 60))} min`}
              </Text>
            ) : null}
          </View>

          <StopRow
            color={PICKUP}
            title={order.pickup.farmerName}
            address={addressLine(order.pickup.address)}
            distance={toFarmer != null ? km(toFarmer) : undefined}
          />
          <StopRow
            color={DELIVERY}
            title={order.delivery.buyerName}
            address={addressLine(order.delivery.address)}
            distance={toBuyer != null ? km(toBuyer) : undefined}
            last
          />

          <Text style={styles.itemsLabel}>{t("preview.products", { count: order.pickup.items.length })}</Text>
          <ScrollView style={styles.items} showsVerticalScrollIndicator={false}>
            {order.pickup.items.map((item, index) => (
              <Text key={`${item.productId}-${index}`} style={styles.itemText}>
                {itemLine(item)}
              </Text>
            ))}
          </ScrollView>

          <Pressable
            style={[styles.acceptButton, accepting && { opacity: 0.6 }]}
            onPress={() => onAccept(order.orderId)}
            disabled={accepting}
            accessibilityRole="button"
            accessibilityLabel={t("preview.acceptA11y")}
          >
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptText}>{t("preview.accept")}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  map: { flex: 1 },
  closeButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  mapNote: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mapNoteText: { fontFamily: fontFamily.medium, fontSize: 13, color: INK },
  panel: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  fare: { fontFamily: fontFamily.bold, fontSize: 24, color: GREEN },
  total: { fontFamily: fontFamily.medium, fontSize: 14, color: MUTED },
  stopRow: { flexDirection: "row", alignItems: "flex-start" },
  spine: { width: 20, alignItems: "center", alignSelf: "stretch" },
  stopDot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  spineLine: { flex: 1, width: 2, backgroundColor: "#D8D8D8", marginVertical: 2 },
  stopText: { flex: 1, paddingLeft: 10, paddingBottom: 12 },
  stopTitle: { fontFamily: fontFamily.bold, fontSize: 16, color: INK },
  stopAddress: { fontFamily: fontFamily.medium, fontSize: 13, color: MUTED, lineHeight: 18 },
  stopDistance: { fontFamily: fontFamily.semiBold, fontSize: 14, color: INK, paddingLeft: 8 },
  itemsLabel: { fontFamily: fontFamily.semiBold, fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 6 },
  items: { maxHeight: 108 },
  itemText: { fontFamily: fontFamily.medium, fontSize: 15, color: INK, lineHeight: 22 },
  acceptButton: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: { fontFamily: fontFamily.bold, fontSize: 16, color: "#FFFFFF" },
});
