/**
 * src/features/riders/presentation/screens/DeliveryChatPage.tsx
 *
 * Rider chat with the farmer or the buyer of the delivery (RID-41), opened
 * from the message button on Active Delivery. Polls every 4 s while focused
 * and in the foreground. Read-only once the delivery has ended.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { showSaganaToast } from "@/components/ui/saganaToastConfig";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useUser } from "@/context/UserContext";
import { styles } from "@/features/riders/presentation/styles/DeliveryChatPage.styles";
import { usePollWhileActive } from "@/hooks/usePollWhileActive";
import { latestMessageId, mergeMessages, type ChatMessage } from "@/lib/chatMessages";
import { useT } from "@/lib/i18n";
import {
  conflictMessage,
  isDeliveryChatWith,
  listMessages,
  openDeliveryChat,
  sendMessage,
  type DeliveryChat,
  type DeliveryChatWith,
} from "@/lib/riderChatApi";

const CHAT_POLL_INTERVAL_MS = 4000;

type Load =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "blocked"; message: string }
  | { kind: "ready"; chat: DeliveryChat };

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function DeliveryChatPage() {
  const params = useLocalSearchParams<{ orderId?: string; with?: string }>();
  const orderId = Number(params.orderId) || 0;
  const withWhom = isDeliveryChatWith(params.with) ? params.with : null;
  // Tab screens stay mounted, so a new order or person remounts the chat with fresh state.
  return <Chat key={`${orderId}:${withWhom}`} orderId={orderId} withWhom={withWhom} />;
}

function Chat({ orderId, withWhom }: { orderId: number; withWhom: DeliveryChatWith | null }) {
  const router = useRouter();
  const t = useT();
  const { user } = useUser();
  const valid = orderId > 0 && withWhom !== null;

  const [load, setLoad] = useState<Load>(valid ? { kind: "loading" } : { kind: "failed" });
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const messagesRef = useRef(messages);
  const sendingRef = useRef(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const chat = load.kind === "ready" ? load.chat : null;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!withWhom || orderId <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        const opened = await openDeliveryChat(orderId, withWhom);
        const { messages: list, meta } = await listMessages(opened.id);
        if (cancelled) return;
        setMessages(mergeMessages([], list));
        setReadOnly(opened.readOnly || meta.readOnly);
        setLoad({ kind: "ready", chat: opened });
      } catch (e) {
        if (cancelled) return;
        const conflict = conflictMessage(e);
        setLoad(
          conflict === null
            ? { kind: "failed" }
            : { kind: "blocked", message: conflict || t("chat.notOpen") },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, withWhom, attempt, t]);

  const poll = useCallback(async () => {
    if (!chat) return;
    const { messages: fresh, meta } = await listMessages(
      chat.id,
      latestMessageId(messagesRef.current),
    );
    setMessages((prev) => mergeMessages(prev, fresh));
    setReadOnly(meta.readOnly);
  }, [chat]);

  usePollWhileActive(poll, {
    enabled: chat !== null && !readOnly,
    intervalMs: CHAT_POLL_INTERVAL_MS,
    shouldSkip: () => sendingRef.current,
  });

  const send = async () => {
    const body = draft.trim();
    if (!chat || !body || sendingRef.current) return;
    const tempId = -Date.now();
    sendingRef.current = true;
    setDraft("");
    setMessages((prev) =>
      mergeMessages(prev, [
        { id: tempId, senderId: user?.id ?? 0, body, createdAt: new Date().toISOString(), pending: true },
      ]),
    );
    try {
      const sent = await sendMessage(chat.id, body);
      setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), [sent]));
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (conflictMessage(e) !== null) {
        setReadOnly(true);
      } else {
        setDraft(body);
        showSaganaToast({ type: "error", text1: t("chat.sendFailed") });
      }
    } finally {
      sendingRef.current = false;
    }
  };

  const roleLabel = t(withWhom === "farmer" ? "chat.farmer" : "chat.buyer");
  const name = chat?.otherUser.name || roleLabel;
  const subtitle = chat?.orderCode ? `${roleLabel} · ${chat.orderCode}` : roleLabel;

  const goBack = () =>
    router.navigate({
      pathname: "/tabs/ActiveDeliveryPage",
      params: { orderId: String(orderId) },
    } as never);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.pending || item.senderId === user?.id;
    return (
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          item.pending && styles.bubblePending,
        ]}
      >
        <Text style={mine ? styles.bodyMine : styles.bodyTheirs}>{item.body}</Text>
        <Text style={mine ? styles.timeMine : styles.timeTheirs}>{formatTime(item.createdAt)}</Text>
      </View>
    );
  };

  const canSend = draft.trim().length > 0;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.flex} edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
            >
              <MaterialIcons name={IconTheme.back} size={22} color="#087434" />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text>
            </View>
          </View>

          {load.kind === "loading" && (
            <View style={styles.center}>
              <ActivityIndicator color="#087434" />
            </View>
          )}

          {load.kind === "failed" && (
            <View style={styles.center}>
              <MaterialIcons name={IconTheme.message} size={48} color="#C4C4C4" />
              <Text style={styles.centerText}>{t("chat.loadFailed")}</Text>
              {valid && (
                <Pressable
                  style={styles.retryButton}
                  onPress={() => {
                    setLoad({ kind: "loading" });
                    setAttempt((n) => n + 1);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryText}>{t("common.retry")}</Text>
                </Pressable>
              )}
            </View>
          )}

          {load.kind === "blocked" && (
            <View style={styles.center}>
              <MaterialIcons name={IconTheme.message} size={48} color="#C4C4C4" />
              <Text style={styles.centerText}>{load.message}</Text>
            </View>
          )}

          {chat && (
            <>
              <FlatList
                ref={listRef}
                style={styles.flex}
                data={messages}
                keyExtractor={(m) => String(m.id)}
                renderItem={renderMessage}
                contentContainerStyle={styles.list}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text style={styles.centerText}>{t("chat.empty")}</Text>
                  </View>
                }
              />
              {readOnly ? (
                <Text style={styles.readOnlyNote}>{t("chat.readOnly")}</Text>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={t("chat.placeholder")}
                    placeholderTextColor="#7A7A7A"
                    multiline
                    accessibilityLabel={t("chat.placeholder")}
                  />
                  <Pressable
                    style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                    onPress={send}
                    disabled={!canSend}
                    accessibilityRole="button"
                    accessibilityLabel={t("chat.send")}
                    accessibilityState={{ disabled: !canSend }}
                  >
                    <MaterialIcons name={IconTheme.send} size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
