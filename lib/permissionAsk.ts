// lib/permissionAsk.ts — when the Rider app asks for notifications and location (RID-48).

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Alert, Linking } from "react-native";

import { t } from "./i18n";
import { getNotificationPermission, registerPush, registerPushIfNew } from "./notifications";

/** "Not now" holds the explanation back this long. */
export const ASK_AGAIN_AFTER_MS = 24 * 60 * 60 * 1000;
const LAST_ASKED_KEY = "rider_permission_ask_last";

export function isAskDue(lastAskedAt: number | null, now: number): boolean {
  return lastAskedAt === null || now - lastAskedAt >= ASK_AGAIN_AFTER_MS;
}

let asking = false;

function explain(blocked: boolean): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      t("permissions.title"),
      t(blocked ? "permissions.settingsBody" : "permissions.body"),
      [
        { text: t("permissions.notNow"), style: "cancel", onPress: () => resolve(false) },
        {
          text: t(blocked ? "delivery.openSettings" : "permissions.allow"),
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

/**
 * Call when the rider goes On Duty or accepts an order. If notifications or
 * location are missing, explains why first (at most once a day after
 * "Not now"), then shows the system prompts, or Settings after a permanent
 * denial. Returns true when the rider tapped Allow, so callers can refresh GPS.
 */
export async function askRiderPermissions(): Promise<boolean> {
  if (asking) return false;
  asking = true;
  try {
    const notifications = await getNotificationPermission();
    const location = await Location.getForegroundPermissionsAsync();
    const needsLocation = location.status !== Location.PermissionStatus.GRANTED;
    if (notifications.granted) await registerPushIfNew();
    if (notifications.granted && !needsLocation) return false;

    const last = Number(await AsyncStorage.getItem(LAST_ASKED_KEY)) || null;
    if (!isAskDue(last, Date.now())) return false;
    await AsyncStorage.setItem(LAST_ASKED_KEY, String(Date.now()));

    const notificationsBlocked = !notifications.granted && !notifications.canAskAgain;
    const locationBlocked = needsLocation && location.canAskAgain === false;
    if (!(await explain(notificationsBlocked || locationBlocked))) return false;

    if (!notifications.granted && !notificationsBlocked) await registerPush(true);
    if (needsLocation && !locationBlocked) await Location.requestForegroundPermissionsAsync();
    if (notificationsBlocked || locationBlocked) await Linking.openSettings().catch(() => {});
    return true;
  } catch {
    return false;
  } finally {
    asking = false;
  }
}
