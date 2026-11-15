// lib/sentry.ts — crash reporting (OPS-11).
// Off unless EXPO_PUBLIC_SENTRY_DSN is set (expo.dev env vars), so local runs and Expo Go send nothing.
// Events carry the user id only: no emails, phones, console logs or URL query strings.
import * as Sentry from "@sentry/react-native";

/** Drops console logs (they can print user data) and strips query strings from request URLs. */
export function scrubBreadcrumb(crumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (crumb.category === "console") return null;
  const url = crumb.data?.url;
  if (typeof url === "string") crumb.data = { ...crumb.data, url: url.split("?")[0] };
  return crumb;
}

/** Starts Sentry once. Returns false (and does nothing) when no DSN is configured. */
export function initSentry(dsn = process.env.EXPO_PUBLIC_SENTRY_DSN): boolean {
  if (!dsn || Sentry.getClient()) return false;
  const buildProfile = process.env.EXPO_PUBLIC_BUILD_PROFILE ?? "local";
  Sentry.init({
    dsn,
    environment: buildProfile,
    sendDefaultPii: false,
    beforeBreadcrumb: scrubBreadcrumb,
    initialScope: { tags: { app_variant: "rider", build_profile: buildProfile } },
  });
  return true;
}

/** Tags later events with the signed-in user's id; ids <= 0 are placeholders, not real users. */
export function setSentryUser(id: number | null | undefined): void {
  Sentry.setUser(id && id > 0 ? { id: String(id) } : null);
}

/** Reports a caught error. A no-op until initSentry has run with a DSN. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) console.error("[captured]", error, context);
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
