import api from "@/lib/api";
import { t } from "@/lib/i18n";

/** Rules for `DELETE /user`, as in the buyer app. Riders always sign in with a password. */

interface ApiFailure {
  response?: {
    status?: number;
    data?: { message?: string; reasons?: unknown };
  };
}

export function deleteAccount(password: string) {
  return api.delete("/user", { data: { password } });
}

/** A 401 here means the token is gone, which is also what a retry sees after a timed-out delete succeeded. */
export function isSessionGone(error: unknown): boolean {
  return (error as ApiFailure)?.response?.status === 401;
}

export function deleteErrorMessages(error: unknown): string[] {
  const response = (error as ApiFailure)?.response;
  const message = response?.data?.message;

  if (response?.status === 409) {
    const reasons = response.data?.reasons;
    const given = Array.isArray(reasons)
      ? reasons.map((reason) => reason?.message).filter((text): text is string => typeof text === "string" && !!text)
      : [];
    return given.length > 0 ? given : [message || t("account.deleteBlocked")];
  }
  if (response?.status === 422) return [message || t("account.deleteWrongPassword")];
  return [t("account.deleteRetry")];
}
