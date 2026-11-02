/**
 * src/features/riders/presentation/screens/EditProfilePage.tsx
 *
 * Edit Profile page — rider can update their name, phone number,
 * vehicle type, plate number, and license number.
 *
 * Calls PATCH /api/rider/profile on save, then navigates back.
 */

import { stylesFactory } from "@/features/riders/presentation/styles/EditProfilePage.styles";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { fontFamily, fontWeight } from "@/constants/FontTheme";
import { useColors } from "@/hooks/useColors";
import { useT, type TextKey } from "@/lib/i18n";
import {
  getRiderProfile,
  updateRiderProfile,
  type RiderProfileData,
  type VehicleType,
} from "@/lib/riderProfileApi";
import { handleApiError, handleApiSuccess } from "@/utils/errorHandler";

const PROFILE_IMAGE = require("@/assets/images/default-avatar.png");

const VEHICLE_OPTIONS: { value: VehicleType; label: TextKey; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: "motorcycle", label: "vehicle.motorcycle", icon: "two-wheeler" },
  { value: "scooter", label: "vehicle.scooter", icon: "two-wheeler" },
  { value: "car", label: "vehicle.car", icon: "directions-car" },
  { value: "bicycle", label: "vehicle.bicycle", icon: "pedal-bike" },
  { value: "tricycle", label: "vehicle.tricycle", icon: "two-wheeler" },
];

export default function EditProfilePage() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const router = useRouter();
  const t = useT();

  const [profile, setProfile] = useState<RiderProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("motorcycle");
  const [plateNumber, setPlateNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  // Fetch profile on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getRiderProfile();
        if (!mounted) return;
        setProfile(data);
        setName(data.name ?? "");
        setPhoneNumber(data.phone_number ?? "");
        setVehicleType((data.vehicle_type as VehicleType) ?? "motorcycle");
        setPlateNumber(data.vehicle_plate_number ?? "");
        setLicenseNumber(data.license_number ?? "");
      } catch (e) {
        if (__DEV__) console.warn("[EditProfile] Failed to fetch:", e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("editProfile.required"), t("editProfile.nameEmpty"));
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateRiderProfile({
        name: name.trim(),
        phone_number: phoneNumber.trim() || null,
        vehicle_type: vehicleType,
        vehicle_plate_number: plateNumber.trim() || null,
        license_number: licenseNumber.trim() || null,
      });
      handleApiSuccess(t("editProfile.updated"), t("editProfile.saved"));
      router.back();
    } catch (e: any) {
      handleApiError(e, t("editProfile.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel={t("editProfile.goBack")}
            >
              <MaterialIcons name={IconTheme.arrowBack} size={22} color={colors.textDark} />
            </Pressable>
            <Text style={styles.headerTitle}>{t("profile.editProfile")}</Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel={t("editProfile.goBack")}
          >
            <MaterialIcons name={IconTheme.arrowBack} size={22} color={colors.textDark} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("profile.editProfile")}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar (display only — upload in future phase) */}
          <View style={styles.avatarSection}>
            <Image
              source={
                profile?.profile_image
                  ? { uri: profile.profile_image }
                  : PROFILE_IMAGE
              }
              style={styles.avatar}
            />
            <Text style={styles.avatarHint}>
              {t("editProfile.photoSoon")}
            </Text>
          </View>

          {/* Personal Info */}
          <Text style={styles.sectionTitle}>{t("editProfile.personal")}</Text>
          <View style={styles.fieldGroup}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t("editProfile.name")}</Text>
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder={t("editProfile.namePlaceholder")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t("editProfile.phone")}</Text>
              <TextInput
                style={styles.fieldInput}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+63 917 000 0000"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Vehicle Info */}
          <Text style={styles.sectionTitle}>{t("editProfile.vehicle")}</Text>
          <View style={styles.fieldGroup}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t("editProfile.type")}</Text>
            </View>
            <View style={styles.vehicleOptionsRow}>
              {VEHICLE_OPTIONS.map((opt) => {
                const isSelected = vehicleType === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.vehicleChip,
                      isSelected ? styles.vehicleChipActive : null,
                    ]}
                    onPress={() => setVehicleType(opt.value)}
                    accessibilityRole="button"
                    accessibilityLabel={t("editProfile.select", { vehicle: t(opt.label) })}
                  >
                    <MaterialIcons
                      name={opt.icon}
                      size={16}
                      color={isSelected ? colors.white : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.vehicleChipText,
                        isSelected ? styles.vehicleChipTextActive : null,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {t(opt.label)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t("editProfile.plate")}</Text>
              <TextInput
                style={styles.fieldInput}
                value={plateNumber}
                onChangeText={setPlateNumber}
                placeholder="ABC-1234"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t("editProfile.license")}</Text>
              <TextInput
                style={styles.fieldInput}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="LIC-00000"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Save button */}
          <Pressable
            style={[styles.saveButton, isSaving ? styles.saveButtonDisabled : null]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={t("editProfile.saveA11y")}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>{t("editProfile.save")}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}