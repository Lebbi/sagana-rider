import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

type Events = { onJoined: () => void; onRemoteJoined: () => void; onRemoteLeft: () => void; onFailed: () => void };

const mockStartCall = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const mockEndCall = jest.fn();
const mockLeave = jest.fn();
let mockEvents: Events | null = null;
let mockPush: ((data: { type?: string; order_id?: unknown }) => void) | null = null;
let mockMic = true;
let mockSupported = true;

jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@/constants/IconTheme", () => ({
  IconTheme: new Proxy({}, { get: () => "x" }),
  MaterialIcons: () => null,
}));
jest.mock("@/lib/callsApi", () => ({
  startCall: (...a: unknown[]) => mockStartCall(...a),
  refreshCallToken: jest.fn(),
  endCall: (...a: unknown[]) => mockEndCall(...a),
}));
jest.mock("@/lib/notifications", () => ({
  listenForPushData: (fn: typeof mockPush) => {
    mockPush = fn;
    return () => {
      mockPush = null;
    };
  },
}));
jest.mock("@/lib/voiceCall", () => ({
  voiceCallSupported: () => mockSupported,
  microphoneAllowed: async () => mockMic,
  joinVoiceCall: (_c: unknown, events: Events) => {
    mockEvents = events;
    return { setMuted: jest.fn(), setSpeaker: jest.fn(), leave: mockLeave };
  },
}));

import InAppCallModal from "../InAppCallModal";

const CREDS = { app_id: "a", channel: "order-7-3", uid: 9, token: "007x", expires_in: 600 };

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

function text(tree: ReactTestRenderer): string {
  return tree.root.findAll((n) => (n.type as unknown) === "Text").map((n) => n.props.children).flat().join("|");
}

describe("in-app call screen", () => {
  let onClose: jest.Mock;
  let onUseDialer: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStartCall.mockReset().mockResolvedValue(CREDS);
    mockEndCall.mockReset();
    mockLeave.mockReset();
    mockEvents = null;
    mockPush = null;
    mockMic = true;
    mockSupported = true;
    onClose = jest.fn();
    onUseDialer = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function open() {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <InAppCallModal orderId={7} callee="buyer" name="Bea Buyer" onUseDialer={onUseDialer} onClose={onClose} />,
      );
    });
    await settle();
    return tree;
  }

  it("rings the buyer, then shows a timer once they answer", async () => {
    const tree = await open();
    expect(mockStartCall).toHaveBeenCalledWith(7, "buyer");
    await act(async () => mockEvents!.onJoined());
    expect(text(tree)).toContain("Ringing...");

    await act(async () => mockEvents!.onRemoteJoined());
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(text(tree)).toMatch(/0:0[23]/);
    expect(mockEndCall).not.toHaveBeenCalled();
  });

  it("after 30 s without an answer it stops the callee's ring and offers the dialer", async () => {
    const tree = await open();
    await act(async () => mockEvents!.onJoined());
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    expect(text(tree)).toContain("No answer. Their app may be closed.");
    expect(mockEndCall).toHaveBeenCalledWith(7, "buyer");
    expect(mockLeave).toHaveBeenCalled();
    const dialer = tree.root.findAll((n) => n.props.accessibilityRole === "button" && n.props.onPress === onUseDialer);
    expect(dialer).toHaveLength(1);
  });

  it("a decline push for this order ends the ring without calling back", async () => {
    const tree = await open();
    await act(async () => mockEvents!.onJoined());
    await act(async () => mockPush!({ type: "call_ended", order_id: 8 }));
    expect(text(tree)).toContain("Ringing...");

    await act(async () => mockPush!({ type: "call_ended", order_id: 7 }));
    expect(text(tree)).toContain("They declined the call.");
    expect(mockEndCall).not.toHaveBeenCalled();
  });

  it("hanging up tells the other side, leaves the channel and closes", async () => {
    const tree = await open();
    await act(async () => mockEvents!.onJoined());
    const hangUp = tree.root.find((n) => n.props.accessibilityLabel === "Hang up" && typeof n.props.onPress === "function");
    await act(async () => hangUp.props.onPress());
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockEndCall).toHaveBeenCalledTimes(1);
    expect(mockLeave).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("closing the screen mid-ring still stops the callee's ring", async () => {
    const tree = await open();
    await act(async () => mockEvents!.onJoined());
    await act(async () => tree.unmount());
    expect(mockEndCall).toHaveBeenCalledWith(7, "buyer");
  });

  it("without the microphone it never rings anyone", async () => {
    mockMic = false;
    const tree = await open();
    expect(mockStartCall).not.toHaveBeenCalled();
    expect(text(tree)).toContain("Allow the microphone to make in-app calls.");
  });

  it("an app build without the Agora module never rings anyone", async () => {
    mockSupported = false;
    const tree = await open();
    expect(mockStartCall).not.toHaveBeenCalled();
    expect(text(tree)).toContain("In-app calling is not available right now.");
  });

  it("a server without Agora set up says calling is unavailable", async () => {
    mockStartCall.mockRejectedValue({ response: { status: 503 } });
    const tree = await open();
    expect(text(tree)).toContain("In-app calling is not available right now.");
  });
});
