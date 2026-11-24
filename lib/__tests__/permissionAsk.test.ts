import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Alert, Linking } from "react-native";

import { getNotificationPermission, registerPush, registerPushIfNew } from "../notifications";
import { ASK_AGAIN_AFTER_MS, askRiderPermissions, isAskDue } from "../permissionAsk";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted" },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));
jest.mock("../notifications", () => ({
  getNotificationPermission: jest.fn(),
  registerPush: jest.fn(),
  registerPushIfNew: jest.fn(),
}));

type Button = { text: string; onPress?: () => void };
let tapButton = 1; // 0 = Not now, 1 = Allow / Open settings

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  tapButton = 1;
  jest.mocked(getNotificationPermission).mockResolvedValue({ granted: false, canAskAgain: true });
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
    status: "undetermined",
    canAskAgain: true,
  } as never);
  jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
    (buttons as Button[])[tapButton].onPress?.();
  });
  jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
});

describe("isAskDue", () => {
  it("asks the first time, then waits a day after Not now", () => {
    expect(isAskDue(null, 1000)).toBe(true);
    expect(isAskDue(1000, 1000 + ASK_AGAIN_AFTER_MS - 1)).toBe(false);
    expect(isAskDue(1000, 1000 + ASK_AGAIN_AFTER_MS)).toBe(true);
  });
});

describe("askRiderPermissions", () => {
  it("explains first, then asks for notifications and location", async () => {
    expect(await askRiderPermissions()).toBe(true);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(registerPush).toHaveBeenCalledWith(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it("asks nothing when both are allowed, but registers the token", async () => {
    jest.mocked(getNotificationPermission).mockResolvedValue({ granted: true, canAskAgain: true });
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ status: "granted" } as never);
    expect(await askRiderPermissions()).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(registerPushIfNew).toHaveBeenCalled();
  });

  it("after Not now, waits a day before explaining again", async () => {
    tapButton = 0;
    expect(await askRiderPermissions()).toBe(false);
    expect(registerPush).not.toHaveBeenCalled();
    await askRiderPermissions();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("offers Open settings after a permanent denial", async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: "denied",
      canAskAgain: false,
    } as never);
    await askRiderPermissions();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(registerPush).toHaveBeenCalledWith(true);
    expect(Linking.openSettings).toHaveBeenCalled();
  });
});
