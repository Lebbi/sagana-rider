import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";

import api from "../api";
import { listenForPushTaps, registerPush, unregisterPush } from "../notifications";

const mockFn = () => jest.fn<(...args: any[]) => any>();

const mockNotifications = {
  AndroidImportance: { HIGH: 6 },
  getPermissionsAsync: mockFn(),
  requestPermissionsAsync: mockFn(),
  getExpoPushTokenAsync: mockFn(),
  setNotificationChannelAsync: mockFn(),
  getLastNotificationResponse: mockFn(),
  addNotificationResponseReceivedListener: mockFn(),
};

jest.mock("expo-notifications", () => mockNotifications);
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../api", () => ({
  __esModule: true,
  default: { post: jest.fn(), delete: jest.fn() },
}));

const tap = (identifier: string, data: object) => ({
  notification: { request: { identifier, content: { data } } },
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockNotifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
  mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
    data: "ExponentPushToken[x]",
  });
  mockNotifications.getLastNotificationResponse.mockReturnValue(null);
  mockNotifications.addNotificationResponseReceivedListener.mockReturnValue({
    remove: jest.fn(),
  });
});

describe("registerPush", () => {
  it("saves the token as a rider device and keeps it for logout", async () => {
    await registerPush();
    expect(api.post).toHaveBeenCalledWith("/push-tokens", {
      token: "ExponentPushToken[x]",
      app: "rider",
      platform: "ios",
    });
    await unregisterPush();
    expect(api.delete).toHaveBeenCalledWith("/push-tokens", {
      data: { token: "ExponentPushToken[x]" },
      timeout: 3000,
    });
  });

  it("does nothing when permission is denied", async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: "denied" });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      status: "denied",
    });
    await registerPush();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("swallows a failed token fetch", async () => {
    mockNotifications.getExpoPushTokenAsync.mockRejectedValue(new Error("no"));
    await expect(registerPush()).resolves.toBeUndefined();
  });
});

describe("unregisterPush", () => {
  it("does not let a failed delete block logout", async () => {
    await AsyncStorage.setItem("push_token", "ExponentPushToken[x]");
    jest.mocked(api.delete).mockRejectedValueOnce(new Error("offline"));
    await expect(unregisterPush()).resolves.toBeUndefined();
  });
});

describe("listenForPushTaps", () => {
  it("opens the tap that launched the app once, even after a remount", () => {
    mockNotifications.getLastNotificationResponse.mockReturnValue(
      tap("launch", { order_id: 1 }),
    );
    const open = jest.fn();
    listenForPushTaps(open)();
    listenForPushTaps(open)();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({ order_id: 1 });
  });
});
