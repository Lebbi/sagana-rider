import { SaganaImage } from "@/components/ui/SaganaImage";
import { useEffect, useReducer, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { endCall, refreshCallToken, startCall, type Callee } from "@/lib/callsApi";
import { t, type TextKey } from "@/lib/i18n";
import { listenForPushData } from "@/lib/notifications";
import { joinVoiceCall, microphoneAllowed, voiceCallSupported, type VoiceCall } from "@/lib/voiceCall";
import {
  callReducer,
  RING_TIMEOUT_MS,
  shouldTellCallee,
  type CallEndReason,
  type CallPhase,
} from "@/features/riders/presentation/utils/callPhase";

type Props = {
  orderId: number;
  callee: Callee;
  name: string;
  avatar?: string;
  /** Backup when the in-app call can't connect (RID-35 dialer). */
  onUseDialer: () => void;
  onClose: () => void;
};

const END_TEXT: Record<CallEndReason, TextKey> = {
  no_answer: "call.noAnswer",
  declined: "call.declined",
  remote_hung_up: "call.ended",
  hung_up: "call.ended",
  no_microphone: "call.noMicrophone",
  unavailable: "call.unavailable",
  failed: "call.failed",
};

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statusText(phase: CallPhase, now: number): string {
  switch (phase.kind) {
    case "connecting":
      return t("call.connecting");
    case "ringing":
      return t("call.ringing");
    case "connected":
      return formatSeconds(Math.max(0, Math.floor((now - phase.since) / 1000)));
    case "ended":
      return t(END_TEXT[phase.reason]);
  }
}

/** Mount it to place the call; unmounting hangs up. */
export default function InAppCallModal({ orderId, callee, name, avatar, onUseDialer, onClose }: Props) {
  const [phase, dispatch] = useReducer(callReducer, { kind: "connecting" });
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const callRef = useRef<VoiceCall | null>(null);
  const startedRef = useRef(false);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!voiceCallSupported()) {
        dispatch({ type: "failed", reason: "unavailable" });
        return;
      }
      if (!(await microphoneAllowed())) {
        dispatch({ type: "failed", reason: "no_microphone" });
        return;
      }
      try {
        const credentials = await startCall(orderId, callee);
        if (cancelled) {
          endCall(orderId, callee);
          return;
        }
        startedRef.current = true;
        callRef.current = joinVoiceCall(
          credentials,
          {
            onJoined: () => dispatch({ type: "joined" }),
            onRemoteJoined: () => dispatch({ type: "remote_joined", at: Date.now() }),
            onRemoteLeft: () => dispatch({ type: "remote_ended" }),
            onFailed: () => dispatch({ type: "failed", reason: "failed" }),
          },
          async () => (await refreshCallToken(orderId, callee)).token,
        );
      } catch (e: any) {
        dispatch({ type: "failed", reason: e?.response?.status === 503 ? "unavailable" : "failed" });
      }
    })();
    const stopListening = listenForPushData((data) => {
      if (data.type === "call_ended" && Number(data.order_id) === orderId) dispatch({ type: "remote_ended" });
    });
    return () => {
      cancelled = true;
      stopListening();
      callRef.current?.leave();
      if (startedRef.current && phaseRef.current.kind !== "ended") endCall(orderId, callee);
    };
  }, [orderId, callee]);

  useEffect(() => {
    if (phase.kind !== "ringing") return;
    const timer = setTimeout(() => dispatch({ type: "ring_timeout" }), RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase.kind]);

  useEffect(() => {
    if (phase.kind !== "connected") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase.kind]);

  useEffect(() => {
    if (phase.kind !== "ended") return;
    callRef.current?.leave();
    if (startedRef.current && shouldTellCallee(phase.reason)) endCall(orderId, callee);
    if (phase.reason === "hung_up" || phase.reason === "remote_hung_up") {
      const timer = setTimeout(onClose, 1200);
      return () => clearTimeout(timer);
    }
  }, [phase, orderId, callee, onClose]);

  const ended = phase.kind === "ended";
  const toggleMute = () => {
    callRef.current?.setMuted(!muted);
    setMuted(!muted);
  };
  const toggleSpeaker = () => {
    callRef.current?.setSpeaker(!speaker);
    setSpeaker(!speaker);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => (ended ? onClose() : dispatch({ type: "hang_up" }))}>
      <View style={styles.screen}>
        <View style={styles.who}>
          {avatar ? (
            <SaganaImage source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <MaterialIcons name={"person" as any} size={56} color="#087434" />
            </View>
          )}
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {statusText(phase, now)}
          </Text>
          <Text style={styles.hint}>{t("call.inAppHint")}</Text>
        </View>

        {ended ? (
          <View style={styles.endedActions}>
            <Pressable style={styles.secondary} onPress={onUseDialer} accessibilityRole="button">
              <MaterialIcons name={IconTheme.phone} size={20} color="#087434" />
              <Text style={styles.secondaryText}>{t("call.useDialer")}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={onClose} accessibilityRole="button">
              <Text style={styles.secondaryText}>{t("call.close")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.controls}>
            <Pressable
              style={[styles.round, muted && styles.roundOn]}
              onPress={toggleMute}
              accessibilityRole="switch"
              accessibilityState={{ checked: muted }}
              accessibilityLabel={t("call.mute")}
            >
              <MaterialIcons name={(muted ? "mic-off" : "mic") as any} size={28} color={muted ? "#FFFFFF" : "#087434"} />
            </Pressable>
            <Pressable
              style={styles.hangUp}
              onPress={() => dispatch({ type: "hang_up" })}
              accessibilityRole="button"
              accessibilityLabel={t("call.hangUp")}
            >
              <MaterialIcons name={"call-end" as any} size={32} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={[styles.round, speaker && styles.roundOn]}
              onPress={toggleSpeaker}
              accessibilityRole="switch"
              accessibilityState={{ checked: speaker }}
              accessibilityLabel={t("call.speaker")}
            >
              <MaterialIcons name={IconTheme.volumeUp as any} size={28} color={speaker ? "#FFFFFF" : "#087434"} />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F9EE", justifyContent: "space-between", paddingVertical: 72, paddingHorizontal: 24 },
  who: { alignItems: "center", gap: 10 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#D7ECC1" },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 24, fontWeight: "700", color: "#1B1C18", textAlign: "center" },
  status: { fontSize: 18, color: "#087434", textAlign: "center" },
  hint: { fontSize: 13, color: "#5B6157", textAlign: "center" },
  controls: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center" },
  round: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#D7ECC1", alignItems: "center", justifyContent: "center" },
  roundOn: { backgroundColor: "#087434" },
  hangUp: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#BA1A1A", alignItems: "center", justifyContent: "center" },
  endedActions: { gap: 12 },
  secondary: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "#087434",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { fontSize: 16, fontWeight: "600", color: "#087434" },
});
