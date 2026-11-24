import { useRouter } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

import { useUser } from "@/context/UserContext";
import { listenForPushTaps, registerPush, registerPushIfNew } from "@/lib/notifications";
import { pushTarget } from "@/lib/pushTarget";

/** Saves this phone's push token and opens tapped pushes for a signed-in rider. */
export function PushNotifications() {
  const { user, loadingUser } = useUser();
  const router = useRouter();

  // Never prompts here: the rider is asked when going On Duty or accepting (RID-48).
  useEffect(() => {
    if (!loadingUser && user?.id) void registerPush();
  }, [loadingUser, user?.id]);

  // A grant made in phone Settings must reach the server too, or pushes silently stop.
  useEffect(() => {
    if (loadingUser || !user?.id) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void registerPushIfNew();
    });
    return () => subscription.remove();
  }, [loadingUser, user?.id]);

  useEffect(() => {
    if (loadingUser || !user?.id) return;
    return listenForPushTaps((data) => router.push(pushTarget(data) as never));
  }, [loadingUser, user?.id, router]);

  return null;
}
