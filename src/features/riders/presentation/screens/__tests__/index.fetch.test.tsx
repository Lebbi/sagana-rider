import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { act, create } from "react-test-renderer";

const mockGetRiderOrders = jest.fn(async () => [] as unknown[]);
const mockGetRiderSettings = jest.fn(async () => ({ autoAccept: false, isOnline: true }));
let mockLocation: { latitude: number; longitude: number } | null = null;

jest.mock("expo-router", () => {
  const R = require("react");
  return {
    useRouter: () => ({ push: jest.fn() }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
  };
});
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));
jest.mock("@/hooks/useColors", () => ({ useColors: () => ({}) }));
jest.mock("@/features/riders/presentation/styles/index.styles", () => ({
  stylesFactory: () => new Proxy({}, { get: () => ({}) }),
}));
jest.mock("@/constants/IconTheme", () => ({
  IconTheme: new Proxy({}, { get: () => "x" }),
  MaterialIcons: () => null,
}));
jest.mock("@/features/riders/presentation/components/NativeMapView", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/lib/mapTiles", () => ({ DEFAULT_MAP_CENTER: { latitude: 0, longitude: 0 } }));
jest.mock("@/utils/errorHandler", () => ({
  handleApiError: jest.fn(),
  handleApiSuccess: jest.fn(),
}));
jest.mock("@/context/AutoAcceptContext", () => {
  const value = {
    autoAcceptEnabled: false,
    setAutoAcceptEnabled: jest.fn(),
    isOnline: true,
    setIsOnline: jest.fn(),
    phase: "idle",
  };
  return { useAutoAccept: () => value };
});
jest.mock("@/features/riders/presentation/hooks/useRiderLocation", () => ({
  useRiderLocation: () => ({ location: mockLocation, refreshLocation: jest.fn() }),
  calculateDistance: () => 0,
}));
jest.mock("@/lib/riderOrdersApi", () => ({
  getRiderOrders: () => mockGetRiderOrders(),
  acceptOrder: jest.fn(),
}));
jest.mock("@/lib/riderSettingsApi", () => ({
  getRiderSettings: () => mockGetRiderSettings(),
  updateRiderSettings: jest.fn(),
}));

import HomeScreen from "../index";

const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  });

describe("home screen order fetching", () => {
  beforeEach(() => {
    mockGetRiderOrders.mockClear();
    mockGetRiderSettings.mockClear();
    mockLocation = null;
  });

  it("does not refetch orders or settings when the GPS location updates", async () => {
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<HomeScreen />);
    });
    await flush();
    const ordersBefore = mockGetRiderOrders.mock.calls.length;
    const settingsBefore = mockGetRiderSettings.mock.calls.length;

    for (let i = 1; i <= 3; i++) {
      mockLocation = { latitude: 14 + i * 0.001, longitude: 121 };
      await act(async () => {
        tree.update(<HomeScreen />);
      });
      await flush();
    }

    const ordersAfter = mockGetRiderOrders.mock.calls.length;
    const settingsAfter = mockGetRiderSettings.mock.calls.length;
    await act(async () => {
      tree.unmount();
    });

    expect(ordersAfter).toBe(ordersBefore);
    expect(settingsAfter).toBe(settingsBefore);
  });
});
