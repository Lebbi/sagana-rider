import { getOrderCardRoute } from "../orderNavigation";

describe("getOrderCardRoute", () => {
  it("opens detail for an available (searching) order", () => {
    expect(getOrderCardRoute({ orderId: 7, status: "searching", isActive: false })).toEqual({
      pathname: "/rider/orders/7",
    });
  });

  it("opens the active delivery screen for an active order", () => {
    expect(getOrderCardRoute({ orderId: 7, status: "to_pickup", isActive: true })).toEqual({
      pathname: "/tabs/ActiveDeliveryPage",
      params: { orderId: "7" },
    });
  });

  it("opens detail for a delivered order", () => {
    expect(getOrderCardRoute({ orderId: 7, status: "delivered", isActive: false })).toEqual({
      pathname: "/rider/orders/7",
    });
  });

  it("opens detail for a cancelled order", () => {
    expect(getOrderCardRoute({ orderId: 7, status: "cancelled", isActive: false })).toEqual({
      pathname: "/rider/orders/7",
    });
  });

  it("lets active win over searching", () => {
    expect(getOrderCardRoute({ orderId: 7, status: "searching", isActive: true })).toEqual({
      pathname: "/tabs/ActiveDeliveryPage",
      params: { orderId: "7" },
    });
  });
});
