import { describe, expect, it, jest } from "@jest/globals";
import Toast from "react-native-toast-message";

import { handleApiError } from "../errorHandler";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("react-native-toast-message", () => ({ __esModule: true, default: { show: jest.fn() } }));

const forbidden = (data: Record<string, unknown>) => ({ response: { status: 403, data } });

describe("handleApiError", () => {
  it("shows a suspension and its reason instead of the screen's failure text", () => {
    handleApiError(
      forbidden({ error: "ACCOUNT_SUSPENDED", reason: "Repeated cancellations" }),
      "Could not accept the order. Please try again.",
    );
    expect(Toast.show).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text1: "Your account is suspended",
        text2: "Reason: Repeated cancellations",
      }),
    );
  });

  it("keeps the screen's text for other refusals", () => {
    handleApiError(forbidden({ message: "No" }), "Could not accept the order. Please try again.");
    expect(Toast.show).toHaveBeenLastCalledWith(
      expect.objectContaining({ text2: "Could not accept the order. Please try again." }),
    );
  });
});
