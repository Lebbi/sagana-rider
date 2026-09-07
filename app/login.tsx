/**
 * app/login.tsx — Sagana Rider
 *
 * Email + password login for riders only. Calls the dedicated
 * POST /api/rider/login endpoint:
 *   - 200 → rider home
 *   - 403 NOT_A_RIDER → "not registered as a rider" message
 *   - 403 RIDER_SUSPENDED / RIDER_INACTIVE / RIDER_BLOCKED → account status message
 *   - 401 → invalid credentials
 */

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  type TextProps,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthCornerOrnaments } from "@/components/auth/BuyerAuthUi";
import { SaganaPressable } from "@/components/ui/SaganaPressable";
import { BrandAssets } from "@/constants/BrandAssets";
import { buyerLoginDesign as d, manrope } from "@/constants/buyerLoginDesign";
import { saganaTouchableActiveOpacity } from "@/constants/pressFeedback";
import { useUser } from "@/context/UserContext";
import { setAuthToken } from "@/lib/api";
import { riderLogin } from "@/lib/riderAuthApi";

import AsyncStorage from "@react-native-async-storage/async-storage";

function LoginText({ style, ...rest }: TextProps) {
  return <Text style={[styles.manropeBase, style]} {...rest} />;
}

function LoginTextInput({ style, ...rest }: TextInputProps) {
  return (
    <TextInput
      style={[styles.textInput, style]}
      placeholderTextColor={d.forgotLink}
      {...rest}
    />
  );
}

function AuthField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.fieldBlock}>
      <LoginText style={styles.fieldLabel}>
        {label}
        {required ? (
          <LoginText style={styles.requiredMark}> *</LoginText>
        ) : null}
      </LoginText>
      {children}
      {error ? <LoginText style={styles.fieldError}>{error}</LoginText> : null}
    </View>
  );
}

export default function RiderLoginScreen() {
  const router = useRouter();
  const { user, loadingUser, setUser } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const mountedRef = useRef(true);
  useRef(() => {
    return () => {
      mountedRef.current = false;
    };
  });

  // Already logged in → straight to rider home
  if (!loadingUser && user) {
    return <Redirect href={{ pathname: "/tabs" }} />;
  }

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
    if (value.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.trim() && !validateEmail(value)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const handleLogin = async () => {
    setErrorMessage("");
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const nextEmailError = !validateEmail(trimmedEmail)
      ? "Please enter a valid email address"
      : "";
    const nextPasswordError = validatePassword(trimmedPassword);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) {
      setErrorMessage("Please fix the errors above before continuing");
      return;
    }

    try {
      setLoading(true);
      const result = await riderLogin(trimmedEmail, trimmedPassword);

      // Persist session (same keys the UserContext/api restore reads)
      await setAuthToken(result.token, result.expires_at);
      await AsyncStorage.setItem("user_id", String(result.user.id));
      await AsyncStorage.setItem("user", JSON.stringify(result.user));
      setUser(result.user as never);

      router.replace("/tabs" as never);
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { message?: string; error?: string } };
        message?: string;
        code?: string;
      };
      let errorMsg = "Login failed. Please try again.";

      if (err?.response?.status === 403) {
        const code = err.response.data?.error ?? "";
        if (code === "NOT_A_RIDER") {
          errorMsg =
            "This account is not registered as a rider. Please use the Sagana app instead.";
        } else if (code === "RIDER_SUSPENDED") {
          errorMsg =
            "Your rider account is suspended. Please contact Sagana support.";
        } else if (code === "RIDER_INACTIVE") {
          errorMsg =
            "Your rider account is inactive. Please contact Sagana support.";
        } else {
          errorMsg =
            err.response.data?.message ??
            "Your rider account cannot access this app. Please contact Sagana support.";
        }
      } else if (err?.response?.status === 401) {
        errorMsg = "Invalid email or password. Please try again.";
      } else if (
        err?.message?.includes("Network") ||
        err?.code === "ECONNREFUSED"
      ) {
        errorMsg =
          "Cannot reach the server. Check your connection and try again.";
      } else if (err?.response?.data?.message) {
        errorMsg = err.response.data.message;
      }

      setErrorMessage(errorMsg);
      Alert.alert("Login Failed", errorMsg);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={d.screenBg} />
      <AuthCornerOrnaments />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.logoCircle}>
                <Image
                  source={BrandAssets.iconLogo}
                  style={styles.logoIcon}
                  tintColor={d.logoOnPrimary}
                  contentFit="contain"
                  accessibilityLabel="Sagana Rider logo"
                />
              </View>
              <LoginText style={styles.title}>Rider Log In</LoginText>
              <LoginText style={styles.subtitle}>
                Welcome back to Sagana Rider!
              </LoginText>
            </View>

            <View style={styles.form}>
              <AuthField label="Email Address" required error={emailError}>
                <LoginTextInput
                  style={emailError ? styles.textInputError : undefined}
                  placeholder=""
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </AuthField>

              <AuthField label="Password" required error={passwordError}>
                <View>
                  <LoginTextInput
                    style={[
                      styles.textInputWithIcon,
                      passwordError ? styles.textInputError : undefined,
                    ]}
                    placeholder=""
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setPasswordError(validatePassword(v));
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <SaganaPressable
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color={d.primary}
                    />
                  </SaganaPressable>
                </View>
              </AuthField>

              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={d.required} />
                  <LoginText style={styles.errorBannerText}>
                    {errorMessage}
                  </LoginText>
                </View>
              ) : null}

              <SaganaPressable
                style={styles.primaryButton}
                onPress={handleLogin}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Log in"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <LoginText style={styles.primaryButtonText}>Log in</LoginText>
                )}
              </SaganaPressable>

              <LoginText style={styles.footerNote}>
                Rider accounts are created by Sagana. Contact support if you
                need a rider account.
              </LoginText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  manropeBase: {
    fontFamily: manrope.regular,
  },
  screen: {
    flex: 1,
    backgroundColor: d.screenBg,
  },
  safeArea: {
    flex: 1,
    backgroundColor: d.screenBg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: d.horizontalPadding,
    paddingTop: 20,
    paddingBottom: 28,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    marginBottom: d.heroBottomSpacing,
  },
  logoCircle: {
    width: d.logoCircleSize,
    height: d.logoCircleSize,
    borderRadius: d.logoCircleSize / 2,
    backgroundColor: d.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: d.logoBottomSpacing,
  },
  logoIcon: {
    width: d.logoIconSize,
    height: d.logoIconSize,
  },
  title: {
    fontFamily: manrope.extraBold,
    fontSize: d.titleSize,
    color: d.primary,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: manrope.medium,
    fontSize: d.subtitleSize,
    color: d.subtitle,
    textAlign: "center",
    lineHeight: 20,
  },
  form: {
    width: "100%",
  },
  fieldBlock: {
    marginBottom: d.fieldGap,
  },
  fieldLabel: {
    fontFamily: manrope.bold,
    fontSize: d.labelSize,
    color: d.primary,
    marginBottom: d.labelToInput,
  },
  requiredMark: {
    color: d.required,
    fontFamily: manrope.bold,
  },
  textInput: {
    height: d.controlHeight,
    backgroundColor: d.inputBg,
    borderWidth: 1,
    borderColor: d.inputBorder,
    borderRadius: d.radius,
    paddingHorizontal: 14,
    fontFamily: manrope.medium,
    fontSize: d.bodySize,
    color: d.primary,
  },
  textInputWithIcon: {
    paddingRight: 42,
  },
  textInputError: {
    borderColor: d.required,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 0,
    height: d.controlHeight,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: d.fieldGap,
    paddingHorizontal: 4,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: manrope.medium,
    fontSize: 13,
    color: d.required,
    lineHeight: 18,
  },
  primaryButton: {
    height: d.controlHeight,
    borderRadius: d.radius,
    backgroundColor: d.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  primaryButtonText: {
    fontFamily: manrope.bold,
    fontSize: d.buttonTextSize,
    color: "#FFFFFF",
  },
  fieldError: {
    fontFamily: manrope.regular,
    fontSize: 12,
    color: d.required,
    marginTop: 6,
  },
  footerNote: {
    fontFamily: manrope.regular,
    fontSize: 13,
    color: d.footerMuted,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});