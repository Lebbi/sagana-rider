// Agora voice for in-app calls (RID-40). react-native-agora is a native module:
// it needs a development or store build and does not load in Expo Go.
import { PermissionsAndroid, Platform } from "react-native";
import type * as Agora from "react-native-agora";

import type { CallCredentials } from "@/lib/callsApi";

export type VoiceCallEvents = {
  onJoined: () => void;
  onRemoteJoined: () => void;
  onRemoteLeft: () => void;
  onFailed: () => void;
};

export type VoiceCall = {
  setMuted: (muted: boolean) => void;
  setSpeaker: (on: boolean) => void;
  leave: () => void;
};

/** iOS asks on first use from NSMicrophoneUsageDescription; Android needs the runtime prompt. */
export async function microphoneAllowed(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** Null in Expo Go and in builds made before RID-40, which lack the native module. */
function loadAgora(): typeof Agora | null {
  try {
    return require("react-native-agora");
  } catch {
    return null;
  }
}

export function voiceCallSupported(): boolean {
  return loadAgora() !== null;
}

/** renewToken failing (the delivery ended) ends the call, so a call never outlives the delivery. */
export function joinVoiceCall(
  credentials: CallCredentials,
  events: VoiceCallEvents,
  renewToken: () => Promise<string>,
): VoiceCall {
  const agora = loadAgora();
  if (!agora) throw new Error("react-native-agora is not in this build");
  const { ChannelProfileType, ClientRoleType, ConnectionStateType, createAgoraRtcEngine } = agora;
  const engine = createAgoraRtcEngine();
  engine.initialize({
    appId: credentials.app_id,
    channelProfile: ChannelProfileType.ChannelProfileCommunication,
  });

  const handler: Agora.IRtcEngineEventHandler = {
    onJoinChannelSuccess: () => events.onJoined(),
    onUserJoined: () => events.onRemoteJoined(),
    onUserOffline: () => events.onRemoteLeft(),
    onTokenPrivilegeWillExpire: () => {
      renewToken().then((token) => engine.renewToken(token)).catch(() => events.onFailed());
    },
    onConnectionStateChanged: (_connection, state) => {
      if (state === ConnectionStateType.ConnectionStateFailed) events.onFailed();
    },
  };
  engine.registerEventHandler(handler);
  engine.enableAudio();
  engine.setDefaultAudioRouteToSpeakerphone(false);
  engine.joinChannel(credentials.token, credentials.channel, credentials.uid, {
    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    publishMicrophoneTrack: true,
    autoSubscribeAudio: true,
  });

  let left = false;
  return {
    setMuted: (muted) => engine.muteLocalAudioStream(muted),
    setSpeaker: (on) => engine.setEnableSpeakerphone(on),
    leave: () => {
      if (left) return;
      left = true;
      engine.unregisterEventHandler(handler);
      engine.leaveChannel();
      engine.release();
    },
  };
}
