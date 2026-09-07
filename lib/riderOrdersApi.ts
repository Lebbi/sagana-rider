/**
 * lib/riderOrdersApi.ts - Sagana Rider
 *
 * Rider order API client - fetching orders, accepting orders,
 * updating delivery status, and broadcasting rider GPS location.
 *
 * All endpoints live on the Sagana backend (see API contract):
 *   GET    /api/rider/orders?status=...
 *   GET    /api/rider/orders/{id}
 *   POST   /api/rider/orders/{id}/accept
 *   PATCH  /api/rider/orders/{id}/status
 *   POST   /api/rider/location
 */

import api from "@/lib/api";
import type { DeliveryStatus, RiderOrder } from "@/types/maps";

// ============================================================
// GET /api/rider/orders?status=...
// ============================================================

export async function getRiderOrders(
  status?: DeliveryStatus,
): Promise<RiderOrder[]> {
  const params = status ? { status } : {};
  const { data } = await api.get<RiderOrder[]>("/rider/orders", { params });
  return data;
}

// ============================================================
// GET /api/rider/orders/:id
// ============================================================

export async function getRiderOrderById(orderId: number): Promise<RiderOrder> {
  const { data } = await api.get<RiderOrder>(`/rider/orders/${orderId}`);
  return data;
}

// ============================================================
// POST /api/rider/orders/:id/accept
// ============================================================

export async function acceptOrder(
  orderId: number,
): Promise<{ success: boolean }> {
  const { data } = await api.post(`/rider/orders/${orderId}/accept`);
  return data;
}

// ============================================================
// PATCH /api/rider/orders/:id/status
// ============================================================

export async function updateOrderStatus(
  orderId: number,
  status: DeliveryStatus,
  proofPhotoBase64?: string,
): Promise<{ success: boolean }> {
  const { data } = await api.patch(`/rider/orders/${orderId}/status`, {
    status,
    proof_photo: proofPhotoBase64,
  });
  return data;
}

// ============================================================
// POST /api/rider/location (broadcast GPS)
// ============================================================

export async function broadcastRiderLocation(
  orderId: number,
  latitude: number,
  longitude: number,
  heading: number | null,
  speed: number | null,
): Promise<void> {
  await api.post("/rider/location", {
    order_id: orderId,
    latitude,
    longitude,
    heading,
    speed,
  });
}

