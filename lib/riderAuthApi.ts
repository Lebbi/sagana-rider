/**
 * lib/riderAuthApi.ts — Sagana Rider
 *
 * Dedicated login for the standalone rider app.
 * Backend: POST /api/rider/login (public, throttle:10,1)
 * Applications: POST /api/rider/register (public, multipart); pending
 * applicants get 403 RIDER_PENDING from login until the owner approves.
 *
 * Non-riders get 403 with error code NOT_A_RIDER;
 * suspended/inactive riders get 403 RIDER_SUSPENDED / RIDER_INACTIVE /
 * RIDER_BLOCKED. Response payload matches the main app's login shape
 * (user + token + expires_at) minus sensitive fields.
 */

import api from "@/lib/api";
import type { TextKey } from "@/lib/i18n";
import type { VehicleType } from "@/lib/riderProfileApi";

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

export interface ApplicationPhoto {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

/** Each is sent as a file part of the same name and opened by the owner in /admin Riders. */
export const APPLICATION_PHOTOS = ["license_photo", "nbi_clearance_photo", "selfie_photo"] as const;
export type ApplicationPhotoField = (typeof APPLICATION_PHOTOS)[number];

const PHOTO_REQUIRED: Record<ApplicationPhotoField, TextKey> = {
  license_photo: "register.photoRequired",
  nbi_clearance_photo: "register.nbiRequired",
  selfie_photo: "register.selfieRequired",
};

/** What the sign-up screen holds while the applicant types. */
export interface RiderApplicationDraft {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  vehicle_type: VehicleType | null;
  vehicle_plate_number: string;
  license_photo: ApplicationPhoto | null;
  nbi_clearance_photo: ApplicationPhoto | null;
  selfie_photo: ApplicationPhoto | null;
}

export type RiderApplicationField = keyof RiderApplicationDraft;

/** A draft that passed the client checks; only this can be sent. */
export type RiderApplication = Omit<RiderApplicationDraft, "vehicle_type" | ApplicationPhotoField> & {
  vehicle_type: VehicleType;
} & Record<ApplicationPhotoField, ApplicationPhoto>;

export type RiderApplicationCheck =
  | { ok: true; application: RiderApplication }
  | { ok: false; errors: Partial<Record<RiderApplicationField, TextKey>> };

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const needsPlate = (vehicle: VehicleType | null) => vehicle !== "bicycle";

/** Mirrors the POST /rider/register rules so most mistakes never reach the server. */
export function checkRiderApplication(draft: RiderApplicationDraft): RiderApplicationCheck {
  const name = draft.name.trim();
  const email = draft.email.trim();
  const password = draft.password.trim();
  const phone = draft.phone_number.trim();
  const plate = needsPlate(draft.vehicle_type) ? draft.vehicle_plate_number.trim() : "";
  const errors: Partial<Record<RiderApplicationField, TextKey>> = {};

  if (!name) errors.name = "register.nameRequired";
  else if (name.length > 255) errors.name = "register.nameLong";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "login.invalidEmail";
  if (password.length < 8) errors.password = "register.passwordShort";
  if (!phone) errors.phone_number = "register.phoneRequired";
  else if (phone.length > 20) errors.phone_number = "register.phoneLong";
  if (!draft.vehicle_type) errors.vehicle_type = "register.vehicleRequired";
  if (needsPlate(draft.vehicle_type) && !plate) errors.vehicle_plate_number = "register.plateRequired";
  else if (plate.length > 20) errors.vehicle_plate_number = "register.plateLong";
  const photos = {} as Record<ApplicationPhotoField, ApplicationPhoto>;
  for (const field of APPLICATION_PHOTOS) {
    const photo = draft[field];
    if (!photo) errors[field] = PHOTO_REQUIRED[field];
    else if (!PHOTO_TYPES.includes(photo.type)) errors[field] = "register.photoType";
    else if ((photo.size ?? 0) > PHOTO_MAX_BYTES) errors[field] = "register.photoLarge";
    else photos[field] = photo;
  }

  if (Object.keys(errors).length > 0 || !draft.vehicle_type) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    application: {
      name,
      email,
      password,
      phone_number: phone,
      vehicle_type: draft.vehicle_type,
      vehicle_plate_number: plate,
      ...photos,
    },
  };
}

/** 201 means the application is waiting for the owner's approval; no token is issued. */
export async function riderRegister(application: RiderApplication): Promise<void> {
  const form = new FormData();
  form.append("name", application.name);
  form.append("email", application.email);
  form.append("password", application.password);
  form.append("phone_number", application.phone_number);
  form.append("vehicle_type", application.vehicle_type);
  if (needsPlate(application.vehicle_type)) {
    form.append("vehicle_plate_number", application.vehicle_plate_number);
  }
  for (const field of APPLICATION_PHOTOS) {
    const { uri, name, type } = application[field];
    // React Native's FormData uploads a { uri, name, type } object as a file part.
    form.append(field, { uri, name, type } as unknown as Blob);
  }
  await api.post("/rider/register", form);
}
