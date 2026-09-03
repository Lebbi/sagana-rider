/**
 * lib/riderSettingsApi.ts
 *
 * Rider settings API client — handles the auto-accept toggle,
 * online/offline status, and max pasabay stops.
 *
 * Uses real backend endpoints (USE_MOCK = false).
 * Flip USE_MOCK to true for local development with mock data.
 *
 * @see docs/maps-implementation-plan.md
 */

import api from "@/lib/api";
import type { RiderSettings, UpdateRiderSettings } from "@/types/maps";

const USE_MOCK = false;

// ============================================================
// GET /api/rider/settings
// ============================================================

export async function getRiderSettings(): Promise<RiderSettings> {
  if (USE_MOCK) {
    return {
      autoAccept: true,
      isOnline: true,
      maxPasabayStops: 3,
    };
  }
  const { data } = await api.get<RiderSettings>("/rider/settings");
  return data;
}

// ============================================================
// PATCH /api/rider/settings
// ============================================================

export async function updateRiderSettings(
  updates: UpdateRiderSettings,
): Promise<RiderSettings> {
  if (USE_MOCK) {
    return {
      autoAccept: updates.autoAccept ?? true,
      isOnline: updates.isOnline ?? true,
      maxPasabayStops: updates.maxPasabayStops ?? 3,
    };
  }
  const { data } = await api.patch<RiderSettings>("/rider/settings", updates);
  return data;
}
