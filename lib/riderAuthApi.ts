/**
 * lib/riderAuthApi.ts — Sagana Rider
 *
 * Dedicated login for the standalone rider app.
 * Backend: POST /api/rider/login (public, throttle:10,1)
 *
 * Non-riders get 403 with error code NOT_A_RIDER;
 * suspended/inactive riders get 403 RIDER_SUSPENDED / RIDER_INACTIVE /
 * RIDER_BLOCKED. Response payload matches the main app's login shape
 * (user + token + expires_at) minus sensitive fields.
 */

import api from "@/lib/api";

export interface RiderLoginResponse {
  message: string;
  user: {
    id: number;
    name: string;
    email: string;
    profile_image?: string | null;
    phone_number?: string | null;
    rider?: {
      id: number;
      user_id: number;
      status?: string | null;
      vehicle_type?: string | null;
      vehicle_plate_number?: string | null;
      license_number?: string | null;
    } | null;
    role: string;
  };
  token: string;
  expires_at: string;
}

export async function riderLogin(
  email: string,
  password: string,
): Promise<RiderLoginResponse> {
  const { data } = await api.post<RiderLoginResponse>("/rider/login", {
    email,
    password,
  });
  return data;
}