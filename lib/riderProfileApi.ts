/**
 * lib/riderProfileApi.ts
 *
 * Rider profile + wallet API client.
 */

import api from "@/lib/api";

export interface RiderProfileData {
  name: string;
  email: string;
  phone_number: string | null;
  profile_image: string | null;
  vehicle_type: string | null;
  vehicle_plate_number: string | null;
  license_number: string | null;
  rating: number;
  total_deliveries: number;
  cancelled_count: number;
  on_time_rate: number;
  available_balance: number;
  total_earnings: number;
}

export interface RiderWalletData {
  available_balance: number;
  pending_balance: number;
  total_earnings: number;
  weekly_earnings: { day: string; value: number }[];
  recent_earnings: {
    date: string;
    amount: number;
    order_id: number | null;
    description: string;
  }[];
}

export async function getRiderProfile(): Promise<RiderProfileData> {
  const { data } = await api.get<RiderProfileData>("/rider/profile");
  return data;
}

export async function getRiderWallet(): Promise<RiderWalletData> {
  const { data } = await api.get<RiderWalletData>("/rider/wallet");
  return data;
}
