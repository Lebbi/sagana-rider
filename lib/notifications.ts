// lib/notifications.ts — push token, foreground display and tap handling.
//
// expo-notifications throws at import inside Expo Go, which has no remote push,
// so it is only required after that check.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";
import { Platform } from "react-native";

import api from "./api";
import type { PushData } from "./pushTarget";

const PUSH_TOKEN_KEY = "push_token";

let Notifications: typeof ExpoNotifications | null = null;

function getNotifications() {
  const isExpoGo =
    Constants.executionEnvironment === "storeClient" ||
    Constants.appOwnership === "expo";
  if (isExpoGo || Platform.OS === "web") return null;
  if (!Notifications) Notifications = require("expo-notifications");
  return Notifications;
}

/** Call once at startup so alerts show while the app is open. */
export function configureNotifications() {
  getNotifications()?.setNotificationHandler({
    // A push with no title is an in-app signal (a call ending), never a banner.
    handleNotification: async (notification) => {
      const show = Boolean(notification.request.content.title);
      return {
        shouldPlaySound: show,
        shouldSetBadge: false,
        shouldShowBanner: show,
        shouldShowList: show,
      };
    },
  });
}

// Set after the server has this phone's token, so a late grant in Settings registers again.
let registeredThisSession = false;

export type NotificationPermission = { granted: boolean; canAskAgain: boolean };

/** Reads the permission without ever showing the system prompt. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  const N = getNotifications();
  if (!N) return { granted: false, canAskAgain: false };
  const { status, canAskAgain } = await N.getPermissionsAsync();
  return { granted: status === "granted", canAskAgain: canAskAgain !== false };
}

/**
 * Saves this phone's push token on the server when notifications are allowed.
 * Shows the system prompt only with `ask` (after the explanation, RID-48).
 * Failures stay silent: a phone without push must still use the app normally.
 * Returns true once the server has the token.
 */
export async function registerPush(ask = false): Promise<boolean> {
  try {
    const N = getNotifications();
    if (!N) return false;

    const { status: existing } = await N.getPermissionsAsync();
    if (existing !== "granted" && !ask) return false;

    // Android 13 shows the permission prompt as soon as a channel exists, so
    // the channel is only made once allowed or right before we ask.
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "Order alerts",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#396B5C",
      });
    }

    const { status } =
      existing === "granted"
        ? { status: existing }
        : await N.requestPermissionsAsync();
    if (status !== "granted") return false;

    const { data: token } = await N.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    await api.post("/push-tokens", {
      token,
      app: "rider",
      platform: Platform.OS,
    });
    registeredThisSession = true;
    return true;
  } catch {
    // Permission, token and network failures all mean no push this session.
    return false;
  }
}

/** For app resume: registers only if this session hasn't yet, e.g. after a grant in Settings. */
export async function registerPushIfNew(): Promise<void> {
  if (!registeredThisSession) await registerPush();
}

/** Call before /logout revokes the auth token, because the delete needs it. */
export async function unregisterPush(): Promise<void> {
  try {
    registeredThisSession = false;
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) return;
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    await api.delete("/push-tokens", { data: { token }, timeout: 3000 });
  } catch {
    // A bad network must not block logout.
  }
}

// Module scope so a remount does not reopen the last tap.
let lastTapId: string | null = null;

/** Reports each tap once, including the tap that launched a closed app. */
export function listenForPushTaps(open: (data: PushData) => void): () => void {
  const N = getNotifications();
  if (!N) return () => {};

  const onResponse = (response: ExpoNotifications.NotificationResponse) => {
    const { identifier, content } = response.notification.request;
    if (identifier === lastTapId) return;
    lastTapId = identifier;
    open(content.data as PushData);
  };

  const last = N.getLastNotificationResponse();
  if (last) onResponse(last);
  const subscription = N.addNotificationResponseReceivedListener(onResponse);
  return () => subscription.remove();
}

/** Every push that arrives while the app is open, including data-only ones. */
export function listenForPushData(onData: (data: PushData) => void): () => void {
  const N = getNotifications();
  if (!N) return () => {};
  const subscription = N.addNotificationReceivedListener((notification) =>
    onData((notification.request.content.data ?? {}) as PushData),
  );
  return () => subscription.remove();
}
