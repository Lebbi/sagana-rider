import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { act, create } from "react-test-renderer";
import { AppState } from "react-native";

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
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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
jest.mock("@/features/riders/presentation/components/OrderPreviewSheet", () => ({
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

import HomeScreen, { ORDER_POLL_MS } from "../index";

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
  }, 20000);
});

describe("home screen order polling", () => {
  let appStateListeners: ((s: string) => void)[];
  let appState: string;

  const settle = () =>
    act(async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
  const tick = (ms: number) =>
    act(async () => {
      jest.advanceTimersByTime(ms);
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
  const setAppState = (s: string) =>
    act(async () => {
      appState = s;
      appStateListeners.forEach((l) => l(s));
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetRiderOrders.mockClear();
    appState = "active";
    appStateListeners = [];
    Object.defineProperty(AppState, "currentState", { get: () => appState, configurable: true });
    jest.spyOn(AppState, "addEventListener").mockImplementation((_e, l) => {
      appStateListeners.push(l as (s: string) => void);
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter((x) => x !== l);
        },
      };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function mount() {
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<HomeScreen />);
    });
    await settle();
    return tree;
  }

  it("polls the order list every 10-15 s while open and in the foreground", async () => {
    expect(ORDER_POLL_MS).toBeGreaterThanOrEqual(10_000);
    expect(ORDER_POLL_MS).toBeLessThanOrEqual(15_000);
    const tree = await mount();
    const start = mockGetRiderOrders.mock.calls.length;

    await tick(ORDER_POLL_MS);
    expect(mockGetRiderOrders.mock.calls.length).toBe(start + 1);
    await tick(ORDER_POLL_MS * 2);
    expect(mockGetRiderOrders.mock.calls.length).toBe(start + 3);

    await act(async () => tree.unmount());
  });

  it("does not poll in the background and fetches again on return", async () => {
    const tree = await mount();
    await setAppState("background");
    const start = mockGetRiderOrders.mock.calls.length;

    await tick(ORDER_POLL_MS * 5);
    expect(mockGetRiderOrders.mock.calls.length).toBe(start);

    await setAppState("active");
    expect(mockGetRiderOrders.mock.calls.length).toBe(start + 1);

    await act(async () => tree.unmount());
  });

  it("stops polling when the screen loses focus", async () => {
    const tree = await mount();
    await act(async () => tree.unmount());
    const start = mockGetRiderOrders.mock.calls.length;

    await tick(ORDER_POLL_MS * 5);
    await setAppState("active");
    expect(mockGetRiderOrders.mock.calls.length).toBe(start);
  });
});
