// app/_layout.tsx — Sagana Rider root layout (placeholder until Phase 4)
import {
  StackSansHeadline_200ExtraLight,
  StackSansHeadline_300Light,
  StackSansHeadline_400Regular,
  StackSansHeadline_500Medium,
  StackSansHeadline_600SemiBold,
  StackSansHeadline_700Bold,
} from "@expo-google-fonts/stack-sans-headline";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, TextInput, type TextStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { defaultInputStyle, defaultTextStyle } from "@/constants/FontTheme";
import { UserProvider } from "@/context/UserContext";
import Toast from "react-native-toast-message";

/**
 * Apply a default text style to every `<Text>` instance in the app.
 * RN 0.81+ removed Text.defaultProps from the public types; the runtime
 * still honors it, so we set it via a typed `unknown` cast.
 */
function applyDefaultTextStyle(style: TextStyle) {
  const anyText = Text as unknown as {
    defaultProps?: { style?: unknown };
  };
  const currentStyle = (anyText.defaultProps?.style ?? []) as unknown[];
  anyText.defaultProps = {
    ...(anyText.defaultProps ?? {}),
    style: [style, ...currentStyle],
  };
}

function applyDefaultTextInputStyle(style: TextStyle) {
  const anyTextInput = TextInput as unknown as {
    defaultProps?: { style?: unknown };
  };
  const currentStyle = (anyTextInput.defaultProps?.style ?? []) as unknown[];
  anyTextInput.defaultProps = {
    ...(anyTextInput.defaultProps ?? {}),
    style: [style, ...currentStyle],
  };
}

export default function RootLayout() {
  const [loaded] = useFonts({
    StackSansHeadline_200ExtraLight,
    StackSansHeadline_300Light,
    StackSansHeadline_400Regular,
    StackSansHeadline_500Medium,
    StackSansHeadline_600SemiBold,
    StackSansHeadline_700Bold,
  });

  useEffect(() => {
    if (!loaded) return;
    applyDefaultTextStyle(defaultTextStyle);
    applyDefaultTextInputStyle(defaultInputStyle);
  }, [loaded]);

  if (!loaded) {
    // Keep the splash screen on until fonts are ready (the expo-splash-screen
    // plugin holds the splash while the first render is empty).
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <UserProvider>
          <Stack screenOptions={{ headerShown: false }} />
          {/* Toast host — required for handleApiSuccess/handleApiError to
              render. Without this, all toasts are silently invisible. */}
          <Toast />
      </UserProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}