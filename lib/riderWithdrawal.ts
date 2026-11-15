import api from "@/lib/api";
import type { TextKey } from "@/lib/i18n";

/** Rider GCash payouts (PAY-07): the rider asks, Sagana pays by GCash on Tuesday and Friday. */

export type WithdrawalStatus = "pending" | "completed" | "failed";

export interface RiderWithdrawal {
  id: number;
  amount: string;
  status: WithdrawalStatus;
  account_name: string;
  account_last_four: string | null;
  reference_number: string | null;
  notes: string | null;
  requested_at: string;
  processed_at: string | null;
}

export interface WithdrawForm {
  amount: string;
  accountName: string;
  accountNumber: string;
}

export async function getRiderWithdrawals(): Promise<RiderWithdrawal[]> {
  const { data } = await api.get<{ data: RiderWithdrawal[] }>("/rider/wallet/withdrawals");
  return data.data;
}

export function requestRiderWithdrawal(form: WithdrawForm) {
  return api.post("/rider/wallet/withdraw", {
    amount: Number(form.amount),
    account_name: form.accountName.trim(),
    account_number: form.accountNumber.trim(),
  });
}

/** Same rules as the server, so the rider sees the reason in their language before sending. */
export function withdrawFormError(
  form: WithdrawForm,
  withdrawable: number,
  min: number,
): { key: TextKey; amount?: number } | null {
  const amount = Number(form.amount);
  if (!form.amount.trim() || !Number.isFinite(amount) || amount < min) return { key: "wallet.errAmountMin", amount: min };
  if (amount > withdrawable) return { key: "wallet.errAmountMax", amount: withdrawable };
  if (!form.accountName.trim()) return { key: "wallet.errName" };
  const number = form.accountNumber.trim();
  if (!/^[0-9 -]{6,40}$/.test(number) || !/[0-9]/.test(number)) return { key: "wallet.errNumber" };
  return null;
}
