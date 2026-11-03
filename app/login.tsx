/**
 * app/login.tsx — Sagana Rider
 *
 * Email + password login for riders only. Calls the dedicated
 * POST /api/rider/login endpoint:
 *   - 200 → rider home
 *   - 403 NOT_A_RIDER → "not registered as a rider" message
 *   - 403 RIDER_PENDING → application pending screen
 *   - 403 RIDER_SUSPENDED / RIDER_INACTIVE / RIDER_BLOCKED → account status message
 *   - 401 → invalid credentials
 */

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AuthCornerOrnaments,
  AuthField,
  LoginText,
  LoginTextInput,
} from "@/components/auth/BuyerAuthUi";
import { SaganaPressable } from "@/components/ui/SaganaPressable";
import { BrandAssets } from "@/constants/BrandAssets";
import { buyerLoginDesign as d, manrope } from "@/constants/buyerLoginDesign";
import { saganaTouchableActiveOpacity } from "@/constants/pressFeedback";
import { useUser } from "@/context/UserContext";
import { setAuthToken } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { riderLogin } from "@/lib/riderAuthApi";
import { getErrorMessage } from "@/utils/errorHandler";

import AsyncStorage from "@react-native-async-storage/async-storage";

export default function RiderLoginScreen() {
  const router = useRouter();
  const t = useT();
  const { user, loadingUser, setUser } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Already logged in → straight to rider home
  if (!loadingUser && user) {
    return <Redirect href={{ pathname: "/tabs" }} />;
  }

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const validatePassword = (value: string) => {
    if (!value) return t("login.passwordRequired");
    if (value.length < 6) return t("login.passwordShort");
    return "";
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.trim() && !validateEmail(value)) {
      setEmailError(t("login.invalidEmail"));
    } else {
      setEmailError("");
    }
  };

  const handleLogin = async () => {
    setErrorMessage("");
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const nextEmailError = !validateEmail(trimmedEmail)
      ? t("login.invalidEmail")
      : "";
    const nextPasswordError = validatePassword(trimmedPassword);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) {
      setErrorMessage(t("login.fixErrors"));
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
      let errorMsg = t("login.failed");

      if (err?.response?.status === 403) {
        const code = err.response.data?.error ?? "";
        if (code === "RIDER_PENDING") {
          router.replace("/pending");
          return;
        }
        if (code === "ACCOUNT_SUSPENDED") {
          const suspended = getErrorMessage(err);
          errorMsg = `${suspended.title}. ${suspended.message}`;
        } else if (code === "NOT_A_RIDER") {
          errorMsg = t("login.notRider");
        } else if (code === "RIDER_SUSPENDED") {
          errorMsg = t("login.suspended");
        } else if (code === "RIDER_INACTIVE") {
          errorMsg = t("login.inactive");
        } else {
          errorMsg = err.response.data?.message ?? t("login.noAccess");
        }
      } else if (err?.response?.status === 401) {
        errorMsg = t("login.wrongCredentials");
      } else if (
        err?.message?.includes("Network") ||
        err?.code === "ECONNREFUSED"
      ) {
        errorMsg = t("login.noServer");
      } else if (err?.response?.data?.message) {
        errorMsg = err.response.data.message;
      }

      setErrorMessage(errorMsg);
      Alert.alert(t("login.failedTitle"), errorMsg);
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
                  accessibilityLabel={t("login.logoA11y")}
                />
              </View>
              <LoginText style={styles.title}>{t("login.title")}</LoginText>
              <LoginText style={styles.subtitle}>
                {t("login.welcome")}
              </LoginText>
            </View>

            <View style={styles.form}>
              <AuthField label={t("login.email")} required error={emailError}>
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

              <AuthField label={t("login.password")} required error={passwordError}>
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
                    accessibilityLabel={showPassword ? t("login.hidePassword") : t("login.showPassword")}
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
                accessibilityLabel={t("login.logIn")}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <LoginText style={styles.primaryButtonText}>{t("login.logIn")}</LoginText>
                )}
              </SaganaPressable>

              <SaganaPressable
                style={styles.applyLink}
                onPress={() => router.push("/register")}
                disabled={loading}
                accessibilityRole="link"
              >
                <LoginText style={styles.applyLinkText}>{t("login.apply")}</LoginText>
              </SaganaPressable>

              <LoginText style={styles.footerNote}>
                {t("login.footer")}
              </LoginText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  applyLink: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 10,
  },
  applyLinkText: {
    fontFamily: manrope.bold,
    fontSize: d.bodySize,
    color: d.primary,
    textDecorationLine: "underline",
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