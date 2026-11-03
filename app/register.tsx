/**
 * app/register.tsx — Sagana Rider
 *
 * Rider application. Posts to POST /api/rider/register (public, multipart).
 * A 201 means the owner still has to approve the rider, so no session is
 * created here; the applicant lands on the pending screen.
 */

import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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
import { buyerLoginDesign as d, manrope } from "@/constants/buyerLoginDesign";
import { useT, type TextKey } from "@/lib/i18n";
import {
  checkRiderApplication,
  needsPlate,
  riderRegister,
  type RiderApplicationDraft,
  type RiderApplicationField,
} from "@/lib/riderAuthApi";
import type { VehicleType } from "@/lib/riderProfileApi";

const VEHICLE_OPTIONS: {
  value: VehicleType;
  label: TextKey;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { value: "motorcycle", label: "vehicle.motorcycle", icon: "two-wheeler" },
  { value: "scooter", label: "vehicle.scooter", icon: "two-wheeler" },
  { value: "car", label: "vehicle.car", icon: "directions-car" },
  { value: "bicycle", label: "vehicle.bicycle", icon: "pedal-bike" },
  { value: "tricycle", label: "vehicle.tricycle", icon: "two-wheeler" },
];

const EMPTY_DRAFT: RiderApplicationDraft = {
  name: "",
  email: "",
  password: "",
  phone_number: "",
  vehicle_type: null,
  vehicle_plate_number: "",
  license_photo: null,
};

type FieldErrors = Partial<Record<RiderApplicationField, string>>;

export default function RiderRegisterScreen() {
  const router = useRouter();
  const t = useT();

  const [draft, setDraft] = useState<RiderApplicationDraft>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const update = <K extends RiderApplicationField>(
    field: K,
    value: RiderApplicationDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const pickPhoto = async (source: "camera" | "library") => {
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setFieldErrors((prev) => ({
          ...prev,
          license_photo: t("register.cameraNeeded"),
        }));
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.6,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const type = asset.mimeType ?? "image/jpeg";
    update("license_photo", {
      uri: asset.uri,
      name: asset.fileName ?? `license.${type.split("/")[1] ?? "jpg"}`,
      type,
      size: asset.fileSize,
    });
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    const check = checkRiderApplication(draft);
    if (!check.ok) {
      const translated: FieldErrors = {};
      for (const [field, key] of Object.entries(check.errors)) {
        translated[field as RiderApplicationField] = t(key);
      }
      setFieldErrors(translated);
      setErrorMessage(t("login.fixErrors"));
      return;
    }

    setSending(true);
    try {
      await riderRegister(check.application);
      router.replace("/pending");
    } catch (error: unknown) {
      const err = error as {
        response?: {
          status?: number;
          data?: { message?: string; errors?: Record<string, string[]> };
        };
        networkError?: boolean;
      };
      const status = err.response?.status;
      let message = t("register.failed");
      if (status === 422) {
        const serverErrors: FieldErrors = {};
        for (const [field, messages] of Object.entries(
          err.response?.data?.errors ?? {},
        )) {
          if (field in EMPTY_DRAFT) {
            serverErrors[field as RiderApplicationField] = messages[0];
          }
        }
        setFieldErrors(serverErrors);
        message = Object.keys(serverErrors).length
          ? t("login.fixErrors")
          : (err.response?.data?.message ?? message);
      } else if (status === 429) {
        message = t("errors.rate");
      } else if (err.networkError) {
        message = t("login.noServer");
      }
      if (!mountedRef.current) return;
      setErrorMessage(message);
      Alert.alert(t("register.failedTitle"), message);
    } finally {
      if (mountedRef.current) setSending(false);
    }
  };

  const plateNeeded = needsPlate(draft.vehicle_type);

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
              <LoginText style={styles.title}>{t("register.title")}</LoginText>
              <LoginText style={styles.subtitle}>
                {t("register.subtitle")}
              </LoginText>
            </View>

            <AuthField
              label={t("register.name")}
              required
              error={fieldErrors.name}
            >
              <LoginTextInput
                style={fieldErrors.name ? styles.textInputError : undefined}
                value={draft.name}
                onChangeText={(v) => update("name", v)}
                autoCapitalize="words"
                autoComplete="name"
                maxLength={255}
              />
            </AuthField>

            <AuthField
              label={t("login.email")}
              required
              error={fieldErrors.email}
            >
              <LoginTextInput
                style={fieldErrors.email ? styles.textInputError : undefined}
                value={draft.email}
                onChangeText={(v) => update("email", v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            </AuthField>

            <AuthField
              label={t("login.password")}
              required
              error={fieldErrors.password}
            >
              <View>
                <LoginTextInput
                  style={[
                    styles.textInputWithIcon,
                    fieldErrors.password ? styles.textInputError : undefined,
                  ]}
                  value={draft.password}
                  onChangeText={(v) => update("password", v)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
                <SaganaPressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword
                      ? t("login.hidePassword")
                      : t("login.showPassword")
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={d.primary}
                  />
                </SaganaPressable>
              </View>
            </AuthField>

            <AuthField
              label={t("register.phone")}
              required
              error={fieldErrors.phone_number}
            >
              <LoginTextInput
                style={
                  fieldErrors.phone_number ? styles.textInputError : undefined
                }
                value={draft.phone_number}
                onChangeText={(v) => update("phone_number", v)}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={20}
              />
            </AuthField>

            <AuthField
              label={t("register.vehicle")}
              required
              error={fieldErrors.vehicle_type}
            >
              <View style={styles.vehicleRow}>
                {VEHICLE_OPTIONS.map((opt) => {
                  const selected = draft.vehicle_type === opt.value;
                  return (
                    <SaganaPressable
                      key={opt.value}
                      style={[
                        styles.vehicleChip,
                        selected ? styles.vehicleChipActive : {},
                      ]}
                      onPress={() => update("vehicle_type", opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t("editProfile.select", {
                        vehicle: t(opt.label),
                      })}
                    >
                      <MaterialIcons
                        name={opt.icon}
                        size={16}
                        color={selected ? d.onPrimary : d.primary}
                      />
                      <LoginText
                        style={[
                          styles.vehicleChipText,
                          selected ? styles.vehicleChipTextActive : undefined,
                        ]}
                      >
                        {t(opt.label)}
                      </LoginText>
                    </SaganaPressable>
                  );
                })}
              </View>
            </AuthField>

            {plateNeeded ? (
              <AuthField
                label={t("register.plate")}
                required
                error={fieldErrors.vehicle_plate_number}
              >
                <LoginTextInput
                  style={
                    fieldErrors.vehicle_plate_number
                      ? styles.textInputError
                      : undefined
                  }
                  value={draft.vehicle_plate_number}
                  onChangeText={(v) => update("vehicle_plate_number", v)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={20}
                />
              </AuthField>
            ) : null}

            <AuthField
              label={t("register.license")}
              required
              error={fieldErrors.license_photo}
            >
              {draft.license_photo ? (
                <Image
                  source={{ uri: draft.license_photo.uri }}
                  style={styles.photoPreview}
                  contentFit="cover"
                  accessibilityLabel={t("register.photoA11y")}
                />
              ) : null}
              <View style={styles.photoButtons}>
                <SaganaPressable
                  style={styles.secondaryButton}
                  onPress={() => pickPhoto("camera")}
                  disabled={sending}
                  accessibilityRole="button"
                >
                  <Ionicons name="camera" size={18} color={d.primary} />
                  <LoginText style={styles.secondaryButtonText}>
                    {t("register.takePhoto")}
                  </LoginText>
                </SaganaPressable>
                <SaganaPressable
                  style={styles.secondaryButton}
                  onPress={() => pickPhoto("library")}
                  disabled={sending}
                  accessibilityRole="button"
                >
                  <Ionicons name="images" size={18} color={d.primary} />
                  <LoginText style={styles.secondaryButtonText}>
                    {t("register.choosePhoto")}
                  </LoginText>
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
              style={[
                styles.primaryButton,
                sending ? styles.primaryButtonBusy : {},
              ]}
              onPress={handleSubmit}
              disabled={sending}
              accessibilityRole="button"
              accessibilityState={{ disabled: sending, busy: sending }}
              accessibilityLabel={t("register.submit")}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <LoginText style={styles.primaryButtonText}>
                  {t("register.submit")}
                </LoginText>
              )}
            </SaganaPressable>

            <SaganaPressable
              style={styles.link}
              onPress={() => router.replace("/login")}
              disabled={sending}
              accessibilityRole="link"
            >
              <LoginText style={styles.linkText}>
                {t("register.haveAccount")}
              </LoginText>
            </SaganaPressable>
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
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
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
  vehicleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vehicleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.inputBorder,
    backgroundColor: d.inputBg,
  },
  vehicleChipActive: {
    backgroundColor: d.primary,
    borderColor: d.primary,
  },
  vehicleChipText: {
    fontFamily: manrope.semiBold,
    fontSize: 14,
    color: d.primary,
  },
  vehicleChipTextActive: {
    color: d.onPrimary,
  },
  photoPreview: {
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: d.radius,
    marginBottom: 10,
    backgroundColor: d.inputBg,
  },
  photoButtons: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: d.controlHeight,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.primary,
    backgroundColor: d.inputBg,
  },
  secondaryButtonText: {
    fontFamily: manrope.bold,
    fontSize: 14,
    color: d.primary,
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
  primaryButtonBusy: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: manrope.bold,
    fontSize: d.buttonTextSize,
    color: "#FFFFFF",
  },
  link: {
    alignItems: "center",
    paddingVertical: 10,
  },
  linkText: {
    fontFamily: manrope.bold,
    fontSize: d.bodySize,
    color: d.primary,
    textDecorationLine: "underline",
  },
});
