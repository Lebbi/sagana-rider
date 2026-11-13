import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Text } from "react-native";

let resolveOrders: (orders: unknown[]) => void = () => {};
const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), navigate: mockNavigate }) }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/hooks/useColors", () => ({ useColors: () => ({}) }));
jest.mock("@/features/riders/presentation/styles/RiderOrdersPage.styles", () => ({
  stylesFactory: () => new Proxy({}, { get: () => ({}) }),
}));
jest.mock("@/constants/IconTheme", () => ({
  IconTheme: new Proxy({}, { get: () => "x" }),
  MaterialIcons: () => null,
}));
jest.mock("@/lib/riderOrdersApi", () => ({
  getRiderOrders: () => new Promise((r) => (resolveOrders = r)),
}));

import RiderOrdersPage from "../RiderOrdersPage";

const order = (status: string) => ({
  orderId: 7,
  orderNumber: "SG-7",
  status,
  createdAt: "2026-11-13T08:00:00Z",
  shippingFee: 50,
});

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((n) => [n.props.children].flat().join(""));

async function render(orders: unknown[]) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RiderOrdersPage />);
  });
  const busy = tree.root.findAll((n) => n.props.accessibilityState?.busy === true);
  await act(async () => resolveOrders(orders));
  return { tree, busyWhileLoading: busy.length > 0 };
}

const pressTab = async (tree: ReactTestRenderer, label: string) =>
  act(async () => {
    tree.root.find((n) => n.props.accessibilityLabel === `Show ${label} orders` && n.props.onPress).props.onPress();
  });

describe("rider orders list", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("shows skeleton cards while loading, then a first-order empty state that leads Home", async () => {
    const { tree, busyWhileLoading } = await render([]);
    expect(busyWhileLoading).toBe(true);
    expect(texts(tree)).toContain("No deliveries yet");
    await act(async () => {
      tree.root.find((n) => n.props.accessibilityRole === "button" && n.props.onPress && texts({ root: n } as ReactTestRenderer).includes("Find orders")).props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/tabs");
    act(() => tree.unmount());
  });

  it("lists orders, and explains an empty tab when the rider has other orders", async () => {
    const { tree } = await render([order("delivered")]);
    expect(texts(tree)).toContain("Order SG-7");
    await pressTab(tree, "New");
    expect(texts(tree)).toContain("No new orders");
    expect(texts(tree)).not.toContain("No deliveries yet");
    act(() => tree.unmount());
  });
});
