/**
 * lib/riderOrdersApi.ts
 *
 * Rider order API client — handles fetching orders, accepting orders,
 * updating delivery status, and broadcasting rider GPS location.
 *
 * Uses real backend endpoints (USE_MOCK = false).
 * Flip USE_MOCK to true for local development with mock data.
 *
 * @see docs/maps-implementation-plan.md
 */

import api from "@/lib/api";
import type { DeliveryStatus, RiderOrder } from "@/types/maps";

const USE_MOCK = false;

// ============================================================
// GET /api/rider/orders?status=new
// ============================================================

export async function getRiderOrders(
  status?: DeliveryStatus,
): Promise<RiderOrder[]> {
  if (USE_MOCK) return mockRiderOrders(status);
  const params = status ? { status } : {};
  const { data } = await api.get<RiderOrder[]>("/rider/orders", { params });
  return data;
}

// ============================================================
// GET /api/rider/orders/:id
// ============================================================

export async function getRiderOrderById(orderId: number): Promise<RiderOrder> {
  if (USE_MOCK) {
    const order = mockRiderOrders().find((o) => o.orderId === orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    return order;
  }
  const { data } = await api.get<RiderOrder>(`/rider/orders/${orderId}`);
  return data;
}

// ============================================================
// POST /api/rider/orders/:id/accept
// ============================================================

export async function acceptOrder(
  orderId: number,
): Promise<{ success: boolean }> {
  if (USE_MOCK) return { success: true };
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
  if (USE_MOCK) return { success: true };
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
  if (USE_MOCK) return;
  await api.post("/rider/location", {
    order_id: orderId,
    latitude,
    longitude,
    heading,
    speed,
  });
}

// ============================================================
// MOCK DATA
// ============================================================

function mockRiderOrders(status?: DeliveryStatus): RiderOrder[] {
  const orders: RiderOrder[] = [
    {
      orderId: 9902,
      orderNumber: "#SG-9902",
      status: "accepted",
      createdAt: "2026-07-15T15:55:00Z",
      shippingFee: 45,
      pickup: {
        farmerId: 101,
        farmerName: "Jerome Bognot",
        farmerPhone: "+63 991 123 4567",
        farmerPhoto:
          "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?q=80&w=300&auto=format&fit=crop",
        address: {
          latitude: 15.0319,
          longitude: 120.6894,
          street: "123 Mabini Street",
          barangay: "San Agustin",
          city: "San Fernando City",
          province: "Pampanga",
          postalCode: "2000",
          landmarkNote: "Blue gate, beside the rice mill",
          recipientName: "Jerome Bognot",
          recipientPhone: "+63 991 123 4567",
        },
        items: [
          {
            productId: 1,
            productName: "Talong",
            variationName: "Premium",
            quantity: 10,
            unit: "kg",
            weightKg: 10,
          },
          {
            productId: 2,
            productName: "Ampalaya",
            variationName: "Premium",
            quantity: 4,
            unit: "kg",
            weightKg: 4,
          },
        ],
      },
      delivery: {
        buyerId: 201,
        buyerName: "Megan Calalahani",
        buyerPhone: "+63 917 765 4321",
        buyerPhoto:
          "https://images.unsplash.com/photo-1618641986557-1ecd230959aa?q=80&w=300&auto=format&fit=crop",
        address: {
          latitude: 15.1756,
          longitude: 120.5883,
          street: "SM City Pampanga",
          barangay: "San Jose",
          city: "San Fernando City",
          province: "Pampanga",
          postalCode: "2000",
          landmarkNote: "Main entrance, near the food court",
          recipientName: "Megan Calalahani",
          recipientPhone: "+63 917 765 4321",
        },
        noteToRider: "Please call when arriving, gate is hard to find",
      },
      paymentMethod: "cod",
      codAmount: 350,
    },
    {
      orderId: 9903,
      orderNumber: "#SG-9903",
      status: "accepted",
      createdAt: "2026-07-15T16:10:00Z",
      shippingFee: 53,
      pickup: {
        farmerId: 102,
        farmerName: "Rosa Dela Cruz",
        farmerPhone: "+63 918 234 5678",
        farmerPhoto:
          "https://images.unsplash.com/photo-1559548331-9c2a7a4c5e8b?q=80&w=300&auto=format&fit=crop",
        address: {
          latitude: 15.055,
          longitude: 120.71,
          street: "78 Bonifacio Street",
          barangay: "Lourdes",
          city: "Angeles City",
          province: "Pampanga",
          postalCode: "2009",
          landmarkNote: "White fence, across the elementary school",
          recipientName: "Rosa Dela Cruz",
          recipientPhone: "+63 918 234 5678",
        },
        items: [
          {
            productId: 3,
            productName: "Kamatis",
            variationName: "Regular",
            quantity: 5,
            unit: "kg",
            weightKg: 5,
          },
        ],
      },
      delivery: {
        buyerId: 202,
        buyerName: "Juan Santos",
        buyerPhone: "+63 919 345 6789",
        buyerPhoto:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop",
        address: {
          latitude: 15.048,
          longitude: 120.695,
          street: "12 MacArthur Highway",
          barangay: "Balibago",
          city: "Angeles City",
          province: "Pampanga",
          postalCode: "2009",
          landmarkNote: "Ground floor, blue gate next to pharmacy",
          recipientName: "Juan Santos",
          recipientPhone: "+63 919 345 6789",
        },
        noteToRider: "",
      },
      paymentMethod: "gcash",
      codAmount: undefined,
    },
  ];

  if (status) return orders.filter((o) => o.status === status);
  return orders;
}
