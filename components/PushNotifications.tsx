import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useUser } from "@/context/UserContext";
import { listenForPushTaps, registerPush } from "@/lib/notifications";
import { pushTarget } from "@/lib/pushTarget";

/** Saves this phone's push token and opens tapped pushes for a signed-in rider. */
export function PushNotifications() {
  const { user, loadingUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loadingUser && user?.id) registerPush();
  }, [loadingUser, user?.id]);

  useEffect(() => {
    if (loadingUser || !user?.id) return;
    return listenForPushTaps((data) => router.push(pushTarget(data) as never));
  }, [loadingUser, user?.id, router]);

  return null;
}
