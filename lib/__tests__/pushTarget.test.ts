import { describe, expect, it } from "@jest/globals";

import { pushTarget } from "../pushTarget";

describe("pushTarget", () => {
  it("opens the order page for a delivery offer", () => {
    expect(pushTarget({ type: "delivery_offer", order_id: 12 })).toBe(
      "/rider/orders/12",
    );
  });

  it("goes to the home tab when the order was cancelled", () => {
    expect(
      pushTarget({ type: "order", order_id: 12, status: "cancelled" }),
    ).toBe("/tabs");
  });

  it.each([[undefined], [null], [{}], [{ order_id: "abc" }], [{ order_id: 0 }]])(
    "goes to the home tab with no usable order id: %j",
    (data) => {
      expect(pushTarget(data)).toBe("/tabs");
    },
  );
});
