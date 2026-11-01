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
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Failures stay silent: a phone without push must still use the app normally. */
export async function registerPush(): Promise<void> {
  try {
    const N = getNotifications();
    if (!N) return;

    // Android 13 only shows the permission prompt once a channel exists.
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "Order alerts",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#396B5C",
      });
    }

    const { status: existing } = await N.getPermissionsAsync();
    const { status } =
      existing === "granted"
        ? { status: existing }
        : await N.requestPermissionsAsync();
    if (status !== "granted") return;

    const { data: token } = await N.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    await api.post("/push-tokens", {
      token,
      app: "rider",
      platform: Platform.OS,
    });
  } catch {
    // Permission, token and network failures all mean no push this session.
  }
}

/** Call before /logout revokes the auth token, because the delete needs it. */
export async function unregisterPush(): Promise<void> {
  try {
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
