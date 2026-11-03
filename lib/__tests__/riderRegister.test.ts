import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import api from "@/lib/api";
import {
  checkRiderApplication,
  riderRegister,
  type RiderApplicationDraft,
} from "@/lib/riderAuthApi";

jest.mock("@/lib/api", () => ({ __esModule: true, default: { post: jest.fn() } }));

// React Native's FormData keeps file parts as { uri, name, type }; Node's does not, so record appends.
class RecordingFormData {
  parts: [string, unknown][] = [];
  append(key: string, value: unknown) {
    this.parts.push([key, value]);
  }
}

const photo = { uri: "file:///license.jpg", name: "license.jpg", type: "image/jpeg", size: 1_000_000 };

const draft = (over: Partial<RiderApplicationDraft> = {}): RiderApplicationDraft => ({
  name: " Juan Dela Cruz ",
  email: "juan@example.com",
  password: "secret123",
  phone_number: "09171234567",
  vehicle_type: "motorcycle",
  vehicle_plate_number: "ABC 1234",
  license_photo: photo,
  ...over,
});

const sentParts = () => {
  const [url, body] = (api.post as jest.Mock).mock.calls[0];
  expect(url).toBe("/rider/register");
  return (body as RecordingFormData).parts;
};

const send = async (d: RiderApplicationDraft) => {
  const check = checkRiderApplication(d);
  if (!check.ok) throw new Error(`unexpected errors ${JSON.stringify(check.errors)}`);
  await riderRegister(check.application);
  return sentParts();
};

beforeEach(() => {
  (api.post as jest.Mock).mockReset();
  (global as { FormData: unknown }).FormData = RecordingFormData;
});

describe("rider application", () => {
  it("sends every contract field and the licence photo as a file part", async () => {
    expect(await send(draft())).toEqual([
      ["name", "Juan Dela Cruz"],
      ["email", "juan@example.com"],
      ["password", "secret123"],
      ["phone_number", "09171234567"],
      ["vehicle_type", "motorcycle"],
      ["vehicle_plate_number", "ABC 1234"],
      ["license_photo", { uri: photo.uri, name: photo.name, type: photo.type }],
    ]);
  });

  it("lets a bicycle rider apply without a plate and sends none", async () => {
    const parts = await send(draft({ vehicle_type: "bicycle", vehicle_plate_number: "" }));
    expect(parts.map(([key]) => key)).not.toContain("vehicle_plate_number");
  });

  it("flags every missing required field", () => {
    const check = checkRiderApplication({
      name: "",
      email: "",
      password: "",
      phone_number: "",
      vehicle_type: null,
      vehicle_plate_number: "",
      license_photo: null,
    });
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(Object.keys(check.errors).sort()).toEqual(
      ["email", "license_photo", "name", "password", "phone_number", "vehicle_type", "vehicle_plate_number"].sort(),
    );
  });

  it.each<[string, Partial<RiderApplicationDraft>, string]>([
    ["a 7-character password", { password: "1234567" }, "password"],
    ["a motorcycle with no plate", { vehicle_plate_number: "  " }, "vehicle_plate_number"],
    ["a plate over 20 characters", { vehicle_plate_number: "X".repeat(21) }, "vehicle_plate_number"],
    ["a phone over 20 characters", { phone_number: "0".repeat(21) }, "phone_number"],
    ["a HEIC photo", { license_photo: { ...photo, type: "image/heic" } }, "license_photo"],
    ["a photo over 5 MB", { license_photo: { ...photo, size: 5 * 1024 * 1024 + 1 } }, "license_photo"],
  ])("rejects %s", (_name, over, field) => {
    const check = checkRiderApplication(draft(over));
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(Object.keys(check.errors)).toEqual([field]);
  });
});
