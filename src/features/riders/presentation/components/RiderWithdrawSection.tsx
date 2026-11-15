import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { showSaganaToast } from "@/components/ui/saganaToastConfig";
import { fontFamily, fontWeight } from "@/constants/FontTheme";
import { useColors } from "@/hooks/useColors";
import { useT, type TextKey } from "@/lib/i18n";
import {
  requestRiderWithdrawal,
  withdrawFormError,
  type RiderWithdrawal,
  type WithdrawalStatus,
  type WithdrawForm,
} from "@/lib/riderWithdrawal";

const STATUS_TEXT: Record<WithdrawalStatus, TextKey> = {
  pending: "wallet.statusPending",
  completed: "wallet.statusCompleted",
  failed: "wallet.statusFailed",
};

const EMPTY_FORM: WithdrawForm = { amount: "", accountName: "", accountNumber: "" };

interface Props {
  withdrawable: number;
  min: number;
  withdrawals: RiderWithdrawal[];
  formatPeso: (amount: number) => string;
  onRequested: () => void;
}

/** PAY-07: ask for a GCash payout, and see past requests. */
export function RiderWithdrawSection({ withdrawable, min, withdrawals, formatPeso, onRequested }: Props) {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<WithdrawForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // State only updates on the next render, too late to stop a double tap.
  const sending = useRef(false);

  const canWithdraw = withdrawable >= min;

  const open = () => {
    // Keep the GCash name and number from last time; only the amount starts empty.
    setForm((f) => ({ ...f, amount: "", accountName: f.accountName || withdrawals[0]?.account_name || "" }));
    setError(null);
    setIsOpen(true);
  };

  const submit = async () => {
    if (sending.current) return;
    const invalid = withdrawFormError(form, withdrawable, min);
    if (invalid) {
      setError(t(invalid.key, invalid.amount === undefined ? undefined : { amount: formatPeso(invalid.amount) }));
      return;
    }
    sending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await requestRiderWithdrawal(form);
      setIsOpen(false);
      setForm((f) => ({ ...f, amount: "" }));
      showSaganaToast({ type: "success", text1: t("wallet.requestedToast") });
      onRequested();
    } catch (e) {
      const response = (e as { response?: { status?: number; data?: { message?: string } } })?.response;
      setError(response?.status === 422 && response.data?.message ? response.data.message : t("common.tryAgain"));
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  };

  const field = (key: keyof WithdrawForm, label: string, extra: Partial<React.ComponentProps<typeof TextInput>>) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={form[key]}
        onChangeText={(value) => setForm((f) => ({ ...f, [key]: value }))}
        editable={!submitting}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...extra}
      />
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("wallet.withdrawals")}</Text>
      <Text style={styles.text}>{t("wallet.withdrawable", { amount: formatPeso(withdrawable) })}</Text>
      {!canWithdraw && <Text style={styles.muted}>{t("wallet.belowMin", { amount: formatPeso(min) })}</Text>}
      <Pressable
        style={[styles.button, !canWithdraw && styles.buttonDisabled]}
        onPress={open}
        disabled={!canWithdraw}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canWithdraw }}
      >
        <Text style={styles.buttonText}>{t("wallet.withdrawButton")}</Text>
      </Pressable>

      {withdrawals.length === 0 ? (
        <Text style={styles.muted}>{t("wallet.noWithdrawals")}</Text>
      ) : (
        withdrawals.map((w) => (
          <View key={w.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>
                {new Date(w.requested_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} ·{" "}
                {formatPeso(Number(w.amount))}
              </Text>
              {w.status === "completed" && w.reference_number ? (
                <Text style={styles.muted}>{t("wallet.reference", { ref: w.reference_number })}</Text>
              ) : null}
              {w.status === "failed" && w.notes ? <Text style={styles.muted}>{w.notes}</Text> : null}
            </View>
            <Text style={[styles.status, w.status === "completed" && styles.paid, w.status === "failed" && styles.failed]}>
              {t(STATUS_TEXT[w.status] ?? "wallet.statusPending")}
            </Text>
          </View>
        ))
      )}

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => !submitting && setIsOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("wallet.withdrawButton")}</Text>
            <Text style={styles.muted}>{t("wallet.withdrawable", { amount: formatPeso(withdrawable) })}</Text>
            {field("amount", t("wallet.amountLabel", { amount: formatPeso(min) }), { keyboardType: "decimal-pad" })}
            {field("accountName", t("wallet.gcashName"), { autoCapitalize: "words" })}
            {field("accountNumber", t("wallet.gcashNumber"), { keyboardType: "phone-pad", placeholder: "09XX XXX XXXX" })}
            {error ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Text style={styles.muted}>{t("wallet.payoutDaysNote")}</Text>
            <Pressable style={styles.button} onPress={submit} disabled={submitting} accessibilityRole="button">
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>{t("wallet.submitWithdraw")}</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.cancel}
              onPress={() => setIsOpen(false)}
              disabled={submitting}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const stylesFactory = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: { backgroundColor: colors.backgroundMuted, borderRadius: 18, padding: 16, gap: 8 },
    title: { fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, fontSize: 16, color: colors.text },
    text: { fontFamily: fontFamily.medium, fontWeight: fontWeight.medium, fontSize: 14, color: colors.text },
    muted: { fontFamily: fontFamily.regular, fontWeight: fontWeight.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
    button: { marginTop: 4, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: colors.primary },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, fontSize: 14, color: colors.white },
    row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
    status: { fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, fontSize: 13, color: colors.textMuted },
    paid: { color: colors.success },
    failed: { color: colors.error },
    backdrop: { flex: 1, justifyContent: "center", paddingHorizontal: 20, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: { backgroundColor: colors.white, borderRadius: 16, padding: 20, gap: 10 },
    sheetTitle: { fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, fontSize: 17, color: colors.text, textAlign: "center" },
    field: { gap: 4 },
    label: { fontFamily: fontFamily.medium, fontWeight: fontWeight.medium, fontSize: 13, color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
    },
    error: { fontFamily: fontFamily.medium, fontWeight: fontWeight.medium, fontSize: 13, color: colors.error },
    cancel: { paddingVertical: 10, alignItems: "center" },
    cancelText: { fontFamily: fontFamily.bold, fontWeight: fontWeight.bold, fontSize: 14, color: colors.textMuted },
  });
