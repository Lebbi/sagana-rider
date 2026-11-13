// Sends delivery updates saved while offline (RID-44): on start, when the
// app comes back to the front, and every 30 s while any are waiting.
import { useEffect } from "react";
import { AppState } from "react-native";

import { showSaganaToast } from "@/components/ui/saganaToastConfig";
import { t } from "@/lib/i18n";
import { flushOutbox, getOutbox } from "@/lib/riderOutbox";

const RETRY_MS = 30000;

async function syncNow() {
  if ((await getOutbox()).length === 0) return;
  const { sent, rejected, left } = await flushOutbox();
  for (const r of rejected) {
    showSaganaToast({
      type: "error",
      text1: t("delivery.offlineRejectedTitle"),
      text2: r.message ?? t("delivery.offlineRejectedBody"),
      visibilityTime: 8000,
    });
  }
  if (sent > 0 && left === 0 && rejected.length === 0) {
    showSaganaToast({ type: "success", text1: t("delivery.offlineSentTitle") });
  }
}

export function RiderOutboxSync() {
  useEffect(() => {
    void syncNow().catch(() => {});
    const timer = setInterval(() => void syncNow().catch(() => {}), RETRY_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void syncNow().catch(() => {});
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return null;
}
