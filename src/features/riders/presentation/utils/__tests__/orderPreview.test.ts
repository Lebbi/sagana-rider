import { describe, expect, it } from "@jest/globals";
import type { RiderOrder } from "@/types/maps";
import { getPreviewStops } from "../orderPreview";

const addr = (latitude: number, longitude: number, coordinatesMissing?: boolean) =>
  ({ latitude, longitude, coordinatesMissing } as never);

const order = (pickup: unknown, delivery: unknown) =>
  ({ pickup: { address: pickup }, delivery: { address: delivery } }) as RiderOrder;

const rider = { latitude: 15.03, longitude: 120.68 };

describe("getPreviewStops", () => {
  it("routes rider to farmer, then farmer to buyer, as separate legs", () => {
    const { legs, pickup, delivery } = getPreviewStops(
      order(addr(15.04, 120.69), addr(15.05, 120.7)),
      rider,
    );
    expect(legs.map((l) => l.to)).toEqual(["farmer", "buyer"]);
    expect(legs[0].request).toMatchObject({ origin: rider, destination: pickup });
    expect(legs[1].request).toMatchObject({ origin: pickup, destination: delivery });
  });

  it("has only the farmer to buyer leg when the rider location is unknown", () => {
    const { legs } = getPreviewStops(order(addr(15.04, 120.69), addr(15.05, 120.7)), null);
    expect(legs.map((l) => l.to)).toEqual(["buyer"]);
  });

  it("drops a stop whose map pin is not set and never routes to it", () => {
    const { legs, delivery } = getPreviewStops(
      order(addr(15.04, 120.69), addr(15.0319, 120.6894, true)),
      rider,
    );
    expect(delivery).toBeNull();
    expect(legs.map((l) => l.to)).toEqual(["farmer"]);
  });

  it("has no legs when the farmer pin is missing", () => {
    expect(getPreviewStops(order(addr(0, 0), addr(15.05, 120.7)), rider).legs).toEqual([]);
  });
});
