import { describe, expect, it, jest } from "@jest/globals";
jest.mock("expo-image", () => ({ Image: () => null }));

import { IMAGE_PLACEHOLDER, isRemoteSource } from "../SaganaImage";

const BASE83 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";
const decode83 = (s: string) => [...s].reduce((v, c) => v * 83 + BASE83.indexOf(c), 0);

describe("SaganaImage", () => {
  it("fades in network photos but not bundled assets", () => {
    expect(isRemoteSource("https://x/a.jpg")).toBe(true);
    expect(isRemoteSource({ uri: "https://x/a.jpg" })).toBe(true);
    expect(isRemoteSource([{ uri: "https://x/a.jpg", width: 100 }])).toBe(true);
    expect(isRemoteSource(42)).toBe(false);
    expect(isRemoteSource({ uri: "" })).toBe(false);
    expect(isRemoteSource(null)).toBe(false);
    expect(isRemoteSource(undefined)).toBe(false);
  });

  it("uses a valid 1x1 blurhash of the soft placeholder tint", () => {
    const hash = IMAGE_PLACEHOLDER.blurhash;
    expect(hash).toHaveLength(6);
    expect(hash.slice(0, 2)).toBe("00");
    expect(decode83(hash.slice(2))).toBe(0xeef1ec);
  });
});
