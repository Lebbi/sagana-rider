import { describe, expect, it } from "@jest/globals";

import { en } from "../i18n/en";
import { tl } from "../i18n/tl";
import {
  WALLET_NO_EARNINGS,
  homeAvailableEmptyState,
  ordersEmptyState,
  type EmptyState,
  type OrdersTab,
} from "../riderEmptyStates";

const TABS: OrdersTab[] = ["All", "New", "Processing", "Delivered"];

describe("rider empty states", () => {
  it("a rider with no orders is told how to get one, on every tab", () => {
    for (const tab of TABS) {
      const state = ordersEmptyState(tab, false);
      expect(state.title).toBe("empty.ordersNoneTitle");
      expect(state.action).toBe("empty.findOrders");
    }
  });

  it("a rider with orders sees why this tab is empty", () => {
    expect(ordersEmptyState("New", true).title).toBe("empty.ordersNewTitle");
    expect(ordersEmptyState("Processing", true).title).toBe("empty.ordersProcessingTitle");
    expect(ordersEmptyState("Delivered", true).title).toBe("empty.ordersDeliveredTitle");
  });

  it("home tells an off-duty rider to turn duty on, and an on-duty rider to wait", () => {
    expect(homeAvailableEmptyState(false).title).toBe("empty.homeOffDutyTitle");
    expect(homeAvailableEmptyState(true).title).toBe("empty.homeWaitingTitle");
  });

  it("every empty-state text exists in English and Tagalog", () => {
    const states: EmptyState[] = [
      ...TABS.flatMap((tab) => [ordersEmptyState(tab, true), ordersEmptyState(tab, false)]),
      WALLET_NO_EARNINGS,
      homeAvailableEmptyState(true),
      homeAvailableEmptyState(false),
    ];
    const keys = states.flatMap((s) => [s.title, s.body, ...(s.action ? [s.action] : [])]);
    for (const key of keys) {
      expect(en[key]).toBeTruthy();
      expect(tl[key]).toBeTruthy();
    }
  });
});
