import { describe, expect, it, jest } from "@jest/globals";

import { withdrawFormError } from "../riderWithdrawal";

jest.mock("@/lib/api", () => ({ __esModule: true, default: {} }));

const ok = { amount: "150", accountName: "Juan Rider", accountNumber: "0917-555-4321" };

describe("withdrawFormError", () => {
  it("accepts a valid request", () => {
    expect(withdrawFormError(ok, 200, 100)).toBeNull();
    expect(withdrawFormError({ ...ok, amount: "200" }, 200, 100)).toBeNull();
  });

  it("checks the amount against the minimum and what is free", () => {
    expect(withdrawFormError({ ...ok, amount: "" }, 200, 100)).toEqual({ key: "wallet.errAmountMin", amount: 100 });
    expect(withdrawFormError({ ...ok, amount: "abc" }, 200, 100)?.key).toBe("wallet.errAmountMin");
    expect(withdrawFormError({ ...ok, amount: "99.99" }, 200, 100)?.key).toBe("wallet.errAmountMin");
    expect(withdrawFormError({ ...ok, amount: "200.01" }, 200, 100)).toEqual({ key: "wallet.errAmountMax", amount: 200 });
  });

  it("needs a GCash name and a number of digits", () => {
    expect(withdrawFormError({ ...ok, accountName: "  " }, 200, 100)?.key).toBe("wallet.errName");
    expect(withdrawFormError({ ...ok, accountNumber: "0917" }, 200, 100)?.key).toBe("wallet.errNumber");
    expect(withdrawFormError({ ...ok, accountNumber: "abc-defg" }, 200, 100)?.key).toBe("wallet.errNumber");
    expect(withdrawFormError({ ...ok, accountNumber: "------" }, 200, 100)?.key).toBe("wallet.errNumber");
  });
});
