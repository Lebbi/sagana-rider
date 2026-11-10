import { describe, expect, it, jest } from "@jest/globals";

type Fix = { watchId: number; latitude: number; longitude: number; timestamp: number };

function loadWith(nativeModule: object | null) {
  const expoLocation = {
    watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
    getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 1, longitude: 2 }, timestamp: 0 })),
  };
  jest.resetModules();
  jest.doMock("expo", () => ({ requireOptionalNativeModule: () => nativeModule }));
  jest.doMock("expo-location", () => expoLocation);
  const lib = require("../googleServices") as typeof import("../googleServices");
  return { lib, expoLocation };
}

function fakeGoogleFreePhone() {
  const listeners = new Set<(fix: Fix) => void>();
  const native = {
    isGooglePlayServicesAvailable: () => false,
    startWatching: jest.fn<(watchId: number, minTimeMs: number, minDistanceM: number) => void>(),
    stopWatching: jest.fn(),
    addListener: jest.fn((_event: string, cb: (fix: Fix) => void) => {
      listeners.add(cb);
      return { remove: () => listeners.delete(cb) };
    }),
  };
  const send = (fix: Fix) => listeners.forEach((cb) => cb(fix));
  return { native, send, listenerCount: () => listeners.size };
}

describe("googleServices", () => {
  it("keeps expo-location when the native module is missing", async () => {
    const { lib, expoLocation } = loadWith(null);
    expect(lib.hasGoogleServices).toBe(true);
    await lib.getCurrentPositionAsync({});
    await lib.watchPositionAsync({}, jest.fn());
    expect(expoLocation.getCurrentPositionAsync).toHaveBeenCalled();
    expect(expoLocation.watchPositionAsync).toHaveBeenCalled();
  });

  it("keeps expo-location on a phone with Google services", async () => {
    const phone = fakeGoogleFreePhone();
    phone.native.isGooglePlayServicesAvailable = () => true;
    const { lib, expoLocation } = loadWith(phone.native);
    expect(lib.hasGoogleServices).toBe(true);
    await lib.watchPositionAsync({}, jest.fn());
    expect(expoLocation.watchPositionAsync).toHaveBeenCalled();
    expect(phone.native.startWatching).not.toHaveBeenCalled();
  });

  it("delivers Android GPS fixes for its own watch only, until removed", async () => {
    const phone = fakeGoogleFreePhone();
    const { lib, expoLocation } = loadWith(phone.native);
    expect(lib.hasGoogleServices).toBe(false);

    const seen: number[] = [];
    const sub = await lib.watchPositionAsync({ timeInterval: 3000, distanceInterval: 5 }, (loc) =>
      seen.push(loc.coords.latitude),
    );
    const watchId = phone.native.startWatching.mock.calls[0][0];
    expect(phone.native.startWatching).toHaveBeenCalledWith(watchId, 3000, 5);

    phone.send({ watchId, latitude: 15.03, longitude: 120.69, timestamp: 1 });
    phone.send({ watchId: watchId + 99, latitude: 99, longitude: 99, timestamp: 2 });
    expect(seen).toEqual([15.03]);

    sub.remove();
    expect(phone.native.stopWatching).toHaveBeenCalledWith(watchId);
    phone.send({ watchId, latitude: 16, longitude: 120, timestamp: 3 });
    expect(seen).toEqual([15.03]);
    expect(expoLocation.watchPositionAsync).not.toHaveBeenCalled();
  });

  it("resolves the current position with the first fix and stops watching", async () => {
    const phone = fakeGoogleFreePhone();
    const { lib } = loadWith(phone.native);
    const pending = lib.getCurrentPositionAsync({});
    await Promise.resolve();
    const watchId = phone.native.startWatching.mock.calls[0][0];
    phone.send({ watchId, latitude: 15.1, longitude: 120.6, timestamp: 5 });
    const loc = await pending;
    expect(loc.coords).toMatchObject({ latitude: 15.1, longitude: 120.6 });
    expect(phone.native.stopWatching).toHaveBeenCalledWith(watchId);
    expect(phone.listenerCount()).toBe(0);
  });

  it("rejects the current position when location services are off", async () => {
    const phone = fakeGoogleFreePhone();
    phone.native.startWatching.mockImplementation(() => {
      throw new Error("Location services are off");
    });
    const { lib } = loadWith(phone.native);
    await expect(lib.getCurrentPositionAsync({})).rejects.toThrow("Location services are off");
    expect(phone.listenerCount()).toBe(0);
  });
});
