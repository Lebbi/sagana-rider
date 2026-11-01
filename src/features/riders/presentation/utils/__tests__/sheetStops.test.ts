import { describe, expect, it } from "@jest/globals";
import { getSheetStops } from "../sheetStops";

describe("getSheetStops", () => {
  it("keeps three stops on a tall screen", () => {
    expect(getSheetStops(520)).toEqual([110, 380, 520]);
  });

  it("drops the default stop when peek sits on or above it", () => {
    expect(getSheetStops(380)).toEqual([110, 380]);
    expect(getSheetStops(300)).toEqual([110, 300]);
    expect(getSheetStops(400)).toEqual([110, 400]);
  });
});
