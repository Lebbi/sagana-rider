import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { AppState, Text, TextInput } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

type Msg = { id: number; senderId: number; body: string; createdAt: string };
const conflict = (error: string) => Object.assign(new Error("409"), { conflict: error });

const mockOpen = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const mockList = jest.fn<(...a: unknown[]) => Promise<{ messages: Msg[]; meta: { readOnly: boolean } }>>();
const mockSend = jest.fn<(...a: unknown[]) => Promise<Msg>>();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => {
  const R = require("react");
  return {
    useRouter: () => ({ navigate: jest.fn() }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void) => R.useEffect(cb, [cb]),
  };
});
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));
jest.mock("@/constants/IconTheme", () => ({
  IconTheme: new Proxy({}, { get: () => "x" }),
  MaterialIcons: () => null,
}));
jest.mock("@/components/ui/saganaToastConfig", () => ({ showSaganaToast: jest.fn() }));
jest.mock("@/context/UserContext", () => ({ useUser: () => ({ user: { id: 7 } }) }));
jest.mock("@/lib/riderChatApi", () => ({
  isDeliveryChatWith: (v: unknown) => v === "buyer" || v === "farmer",
  conflictMessage: (e: { conflict?: string }) => e?.conflict ?? null,
  openDeliveryChat: (...a: unknown[]) => mockOpen(...a),
  listMessages: (...a: unknown[]) => mockList(...a),
  sendMessage: (...a: unknown[]) => mockSend(...a),
}));

import DeliveryChatPage from "../DeliveryChatPage";

const chat = (readOnly = false) => ({
  id: 55,
  orderId: 12,
  orderCode: "SG-12",
  with: "farmer",
  readOnly,
  otherUser: { id: 3, name: "Rosa", profileImage: null },
});
const msg = (id: number, senderId: number, body: string): Msg => ({
  id,
  senderId,
  body,
  createdAt: "2026-11-06T04:00:00Z",
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
const tick = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((n) => [n.props.children].flat().join(""));
const input = (tree: ReactTestRenderer) => tree.root.findAllByType(TextInput)[0];

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<DeliveryChatPage />);
  });
  await settle();
  return tree;
}

async function type(tree: ReactTestRenderer, value: string) {
  await act(async () => input(tree).props.onChangeText(value));
}

async function pressSend(tree: ReactTestRenderer) {
  const send = tree.root.find((n) => n.props.accessibilityLabel === "Send message" && n.props.onPress);
  await act(async () => {
    send.props.onPress();
  });
  await settle();
}

jest.setTimeout(20000);

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(AppState, "currentState", { get: () => "active", configurable: true });
  jest.spyOn(AppState, "addEventListener").mockImplementation((() => ({ remove: jest.fn() })) as never);
  mockParams = { orderId: "12", with: "farmer" };
  mockOpen.mockReset().mockResolvedValue(chat());
  mockList.mockReset().mockResolvedValue({ messages: [], meta: { readOnly: false } });
  mockSend.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("delivery chat", () => {
  it("opens the chat with the farmer and shows its messages", async () => {
    mockList.mockResolvedValueOnce({
      messages: [msg(1, 3, "Ready for pickup"), msg(2, 7, "On my way")],
      meta: { readOnly: false },
    });
    const tree = await render();
    expect(mockOpen).toHaveBeenCalledWith(12, "farmer");
    expect(mockList).toHaveBeenCalledWith(55);
    expect(texts(tree)).toEqual(expect.arrayContaining(["Rosa", "Ready for pickup", "On my way"]));
    expect(input(tree)).toBeDefined();
  });

  it("polls every 4 s for messages after the newest one held", async () => {
    mockList.mockResolvedValueOnce({ messages: [msg(4, 3, "Hi")], meta: { readOnly: false } });
    const tree = await render();
    mockList.mockResolvedValueOnce({ messages: [msg(5, 3, "Gate is blue")], meta: { readOnly: false } });
    await tick(3999);
    expect(mockList).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(mockList).toHaveBeenLastCalledWith(55, 4);
    expect(texts(tree)).toContain("Gate is blue");
  });

  it("shows the server's message and no input when the chat cannot open yet", async () => {
    mockOpen.mockRejectedValue(conflict("Chat opens once a rider accepts this delivery."));
    const tree = await render();
    expect(texts(tree)).toContain("Chat opens once a rider accepts this delivery.");
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it("hides the input on a read-only chat and stops polling", async () => {
    mockList.mockResolvedValue({ messages: [msg(1, 3, "Thanks")], meta: { readOnly: true } });
    const tree = await render();
    expect(texts(tree)).toContain("This delivery has ended, so this chat is read-only.");
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    await tick(20_000);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it("shows a sent message at once and keeps the server's copy", async () => {
    let resolveSend!: (m: Msg) => void;
    mockSend.mockImplementation(() => new Promise<Msg>((r) => (resolveSend = r)));
    const tree = await render();
    await type(tree, "  Nasa labas na ako  ");
    await pressSend(tree);
    expect(mockSend).toHaveBeenCalledWith(55, "Nasa labas na ako");
    expect(texts(tree)).toContain("Nasa labas na ako");
    expect(input(tree).props.value).toBe("");

    await tick(8000);
    expect(mockList).toHaveBeenCalledTimes(1);

    await act(async () => resolveSend(msg(9, 7, "Nasa labas na ako")));
    await settle();
    expect(texts(tree).filter((s) => s === "Nasa labas na ako")).toHaveLength(1);
  });

  it("turns read-only when a send is refused because the delivery ended", async () => {
    mockSend.mockRejectedValue(conflict("This delivery has ended, so this chat is read-only."));
    const tree = await render();
    await type(tree, "Hello");
    await pressSend(tree);
    expect(texts(tree)).not.toContain("Hello");
    expect(texts(tree)).toContain("This delivery has ended, so this chat is read-only.");
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });
});
