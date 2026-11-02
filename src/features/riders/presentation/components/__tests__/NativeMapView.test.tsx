import { describe, expect, it, jest } from "@jest/globals";
import type { ReactTestRenderer } from "react-test-renderer";

let mockMapsKey = "";

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
        fitToCoordinates: () => {},
        animateToRegion: () => {},
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
jest.mock("@/hooks/useColors", () => ({ useColors: () => ({}) }));
jest.mock("@/constants/IconTheme", () => ({ MaterialIcons: "Icon" }));
jest.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));
jest.mock("@/lib/mapTiles", () => ({
  DEFAULT_MAP_CENTER: { latitude: 15, longitude: 120 },
}));

const farmer = { latitude: 15.03, longitude: 120.69 };
const buyer = { latitude: 15.05, longitude: 120.7 };

// The map picks Google Maps or tiles when its module loads, so each case loads a fresh copy.
function renderMap(props: Record<string, unknown> = {}): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  jest.isolateModules(() => {
    const { act, create } = require("react-test-renderer");
    const NativeMapView = require("../NativeMapView").default;
    act(() => {
      tree = create(
        <NativeMapView
          route={null}
          riderLocation={null}
          riderHeading={null}
          destination={buyer}
          destinationType="delivery"
          extraStops={[{ point: farmer, type: "pickup" }]}
          isDarkMode={false}
          {...props}
        />,
      );
    });
  });
  return tree;
}

const pinIcons = (tree: ReactTestRenderer) =>
  tree.root
    .findAll((n) => (n.type as unknown) === "Icon")
    .map((n) => n.props.name)
    .sort();

describe("NativeMapView on a phone", () => {
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
});
