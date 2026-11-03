import { describe, expect, it, jest } from "@jest/globals";

jest.mock("expo-location", () => ({ watchHeadingAsync: jest.fn() }));

import { pickCameraHeading } from "../useCameraHeading";

describe("pickCameraHeading", () => {
  it("follows the GPS course while the rider moves", () => {
    expect(pickCameraHeading(120, 8, 30)).toBe(120);
  });

  it("follows the compass while the rider stands still", () => {
    expect(pickCameraHeading(120, 0.3, 30)).toBe(30);
    expect(pickCameraHeading(-1, 8, 30)).toBe(30);
    expect(pickCameraHeading(null, null, 30)).toBe(30);
  });

  it("points north with no course and no compass", () => {
    expect(pickCameraHeading(null, null, null)).toBe(0);
  });
});
