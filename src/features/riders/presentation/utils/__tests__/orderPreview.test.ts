import { describe, expect, it } from "@jest/globals";
import type { RiderOrder } from "@/types/maps";
import { getPreviewStops } from "../orderPreview";

const addr = (latitude: number, longitude: number, coordinatesMissing?: boolean) =>
  ({ latitude, longitude, coordinatesMissing } as never);

const order = (pickup: unknown, delivery: unknown) =>
  ({ pickup: { address: pickup }, delivery: { address: delivery } }) as RiderOrder;

const rider = { latitude: 15.03, longitude: 120.68 };

describe("getPreviewStops", () => {
  it("routes rider to farmer to buyer when all pins are real", () => {
    const { request, pickup, delivery } = getPreviewStops(
      order(addr(15.04, 120.69), addr(15.05, 120.7)),
      rider,
    );
    expect(pickup).toEqual({ latitude: 15.04, longitude: 120.69 });
    expect(delivery).toEqual({ latitude: 15.05, longitude: 120.7 });
    expect(request?.origin).toEqual(rider);
    expect(request?.waypoints).toEqual([pickup]);
    expect(request?.destination).toEqual(delivery);
  });

  it("starts at the farmer when the rider location is unknown", () => {
    const { request, pickup } = getPreviewStops(
      order(addr(15.04, 120.69), addr(15.05, 120.7)),
      null,
    );
    expect(request?.origin).toEqual(pickup);
    expect(request?.waypoints).toBeUndefined();
  });

  it("drops a stop whose map pin is not set and never routes to it", () => {
    const { request, delivery } = getPreviewStops(
      order(addr(15.04, 120.69), addr(15.0319, 120.6894, true)),
      rider,
    );
    expect(delivery).toBeNull();
    expect(request?.destination).toEqual({ latitude: 15.04, longitude: 120.69 });
    expect(request?.waypoints).toBeUndefined();
  });

  it("has no route when the farmer pin is missing", () => {
    expect(getPreviewStops(order(addr(0, 0), addr(15.05, 120.7)), rider).request).toBeNull();
  });
});
