import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactTestRenderer } from "react-test-renderer";

let mockMapsKey = "";
let mockHasGoogle = true;
const mockAnimateCamera = jest.fn();
const mockFitToCoordinates = jest.fn();
const mockSetCamera = jest.fn();

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: { googleMapsApiKey: mockMapsKey } };
    },
  },
}));
jest.mock("react-native-maps", () => {
  const R = require("react");
  const MapView = R.forwardRef(
    ({ children }: { children: unknown }, ref: unknown) => {
      R.useImperativeHandle(ref, () => ({
        fitToCoordinates: mockFitToCoordinates,
        animateToRegion: () => {},
        animateCamera: mockAnimateCamera,
        setCamera: mockSetCamera,
      }));
      return children;
    },
  );
  return {
    __esModule: true,
    default: MapView,
    Marker: "Marker",
    Polyline: "Polyline",
    PROVIDER_DEFAULT: null,
  };
});
jest.mock(
  "@/features/riders/presentation/components/SimpleMapFallback",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
jest.mock(
  "@/features/riders/presentation/components/RiderNavigationWebView",
  () => ({
    __esModule: true,
    default: "RiderNavigationWebView",
  }),
);
jest.mock("@/lib/googleServices", () => ({
  get hasGoogleServices() {
    return mockHasGoogle;
  },
}));
jest.mock("@/hooks/useColors", () => ({ useColors: () => ({}) }));
jest.mock("@/constants/IconTheme", () => ({ MaterialIcons: "Icon" }));
jest.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));
jest.mock("@/lib/mapTiles", () => ({
  DEFAULT_MAP_CENTER: { latitude: 15, longitude: 120 },
}));

const farmer = { latitude: 15.03, longitude: 120.69 };
const buyer = { latitude: 15.05, longitude: 120.7 };

// The map picks Google Maps or tiles when its module loads, so each case loads a fresh copy.
function renderMap(props: Record<string, unknown> = {}) {
  let tree!: ReactTestRenderer;
  let rerender!: (next: Record<string, unknown>) => void;
  jest.isolateModules(() => {
    const { act, create } = require("react-test-renderer");
    const NativeMapView = require("../NativeMapView").default;
    const el = (p: Record<string, unknown>) => (
      <NativeMapView
        route={null}
        riderLocation={null}
        riderHeading={null}
        destination={buyer}
        destinationType="delivery"
        extraStops={[{ point: farmer, type: "pickup" }]}
        isDarkMode={false}
        {...p}
      />
    );
    act(() => {
      tree = create(el(props));
    });
    rerender = (next) => act(() => tree.update(el(next)));
  });
  return Object.assign(tree, { rerender });
}

const pinIcons = (tree: ReactTestRenderer) =>
  tree.root
    .findAll((n) => (n.type as unknown) === "Icon")
    .map((n) => n.props.name)
    .sort();

describe("NativeMapView on a phone", () => {
  afterEach(() => {
    mockHasGoogle = true;
  });

  it("shows the farmer pin beside the buyer pin on Google Maps", () => {
    mockMapsKey = "key";
    const tree = renderMap();
    expect(
      tree.root.findAll((n) => (n.type as unknown) === "Marker"),
    ).toHaveLength(2);
    expect(pinIcons(tree)).toEqual(["home", "warehouse"]);
  });

  it("shows the farmer pin beside the buyer pin on the keyless tile map", () => {
    mockMapsKey = "";
    expect(pinIcons(renderMap())).toEqual(["home", "warehouse"]);
  });

  const nearOrder = { latitude: 15.052, longitude: 120.701 };
  const farOrder = { latitude: 16.4, longitude: 120.6 };

  it("shows available-order pins only inside the visible area on Google Maps", () => {
    mockMapsKey = "key";
    const tree = renderMap({
      extraStops: undefined,
      areaPins: [nearOrder, farOrder],
    });
    expect(pinIcons(tree)).toEqual(["home", "warehouse"]);
  });

  it("shows available-order pins only inside the visible area on the keyless tile map", () => {
    mockMapsKey = "";
    const tree = renderMap({
      extraStops: undefined,
      areaPins: [nearOrder, farOrder],
    });
    expect(pinIcons(tree)).toEqual(["home", "warehouse"]);
  });

  it("follows the rider when asked, and fits the route otherwise", () => {
    mockMapsKey = "key";
    const rider = { latitude: 15.04, longitude: 120.695 };
    mockAnimateCamera.mockClear();
    mockFitToCoordinates.mockClear();
    renderMap({ riderLocation: rider, followRider: true });
    expect(mockAnimateCamera).toHaveBeenCalledWith(
      { center: rider, zoom: 17, heading: 0, pitch: 0 },
      { duration: 500 },
    );
    expect(mockFitToCoordinates).not.toHaveBeenCalled();

    mockAnimateCamera.mockClear();
    renderMap({ riderLocation: rider });
    expect(mockAnimateCamera).not.toHaveBeenCalled();
    expect(mockFitToCoordinates).toHaveBeenCalled();
  });

  it("turns and tilts the map to the rider's heading, and goes back to north up for the route", () => {
    mockMapsKey = "key";
    const rider = { latitude: 15.04, longitude: 120.695 };
    mockAnimateCamera.mockClear();
    mockSetCamera.mockClear();
    const map = renderMap({ riderLocation: rider, followRider: true, heading: 90 });
    expect(mockAnimateCamera).toHaveBeenLastCalledWith(
      { center: rider, zoom: 18, heading: 90, pitch: 50 },
      { duration: 500 },
    );

    map.rerender({ riderLocation: rider, followRider: false, heading: null });
    expect(mockSetCamera).toHaveBeenCalledWith({ heading: 0, pitch: 0 });
  });

  it("uses the Leaflet map with the farm stop on a phone without Google services", () => {
    mockMapsKey = "key";
    mockHasGoogle = false;
    const rider = { latitude: 15.04, longitude: 120.695 };
    const tree = renderMap({ riderLocation: rider });
    expect(tree.root.findAll((n) => (n.type as unknown) === "Marker")).toHaveLength(0);
    const leaflet = tree.root.findByType("RiderNavigationWebView" as never);
    expect(leaflet.props).toMatchObject({
      destination: buyer,
      riderLocation: rider,
      extraStops: [{ point: farmer, type: "pickup" }],
    });
  });

  it("uses the tile grid with pins for the orders map on a phone without Google services", () => {
    mockMapsKey = "key";
    mockHasGoogle = false;
    const tree = renderMap({ extraStops: undefined, areaPins: [nearOrder, farOrder] });
    expect(tree.root.findAll((n) => (n.type as unknown) === "RiderNavigationWebView")).toHaveLength(0);
    expect(tree.root.findAll((n) => (n.type as unknown) === "Marker")).toHaveLength(0);
    expect(pinIcons(tree)).toEqual(["home", "warehouse"]);
  });
});
