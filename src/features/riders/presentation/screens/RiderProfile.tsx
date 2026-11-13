import { stylesFactory } from "@/features/riders/presentation/styles/RiderProfile.styles";
import { SaganaImage } from "@/components/ui/SaganaImage";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { LANGUAGES, getLanguage, setLanguage, t, useT, type TextKey } from "@/lib/i18n";
import { getRiderProfile, updateRiderProfile, type RiderProfileData, type VehicleType } from "@/lib/riderProfileApi";

interface SelectionOption {
  id: string;
  label: TextKey;
}

interface RiderVehicle {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const PROFILE_IMAGE = require("@/assets/images/default-avatar.png");
const SAGANA_LOGO = require("@/assets/branding/sagana-wordform-logo.png");

const TEXT_SIZE_OPTIONS: SelectionOption[] = [
  { id: "small", label: "textSize.small" },
  { id: "medium", label: "textSize.medium" },
  { id: "large", label: "textSize.large" },
  { id: "extra-large", label: "textSize.extraLarge" },
];

const VEHICLE_LABELS: Record<VehicleType, TextKey> = {
  motorcycle: "vehicle.motorcycle",
  scooter: "vehicle.scooter",
  car: "vehicle.car",
  bicycle: "vehicle.bicycle",
  tricycle: "vehicle.tricycle",
};

// Build the garage list from the rider's real profile data (single vehicle
// per rider in v1) — falls back to a neutral placeholder while loading.
function buildVehicles(profile: RiderProfileData | null): RiderVehicle[] {
  if (!profile || !profile.vehicle_type) {
    return [
      {
        id: "vehicle-none",
        title: t("profile.noVehicle"),
        subtitle: t("profile.contactSupport"),
        icon: "two-wheeler" as keyof typeof MaterialIcons.glyphMap,
      },
    ];
  }
  const typeKey = VEHICLE_LABELS[profile.vehicle_type.toLowerCase() as VehicleType];
  const label = typeKey
    ? t(typeKey)
    : profile.vehicle_type.charAt(0).toUpperCase() + profile.vehicle_type.slice(1);
  const plate = profile.vehicle_plate_number
    ? t("profile.plate", { plate: profile.vehicle_plate_number })
    : t("profile.plateMissing");
  const icon =
    profile.vehicle_type.toLowerCase() === "car"
      ? ("directions-car" as keyof typeof MaterialIcons.glyphMap)
      : ("two-wheeler" as keyof typeof MaterialIcons.glyphMap);
  return [
    {
      id: `vehicle-${profile.vehicle_type}`,
      title: label,
      subtitle: plate,
      icon,
    },
  ];
}

export default function RiderProfile() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useUser();
  const t = useT();
  const language = getLanguage();

  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [selectedTextSize, setSelectedTextSize] = useState<TextKey>("textSize.medium");
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isTextSizeModalVisible, setIsTextSizeModalVisible] = useState(false);
  const [profileData, setProfileData] = useState<RiderProfileData | null>(null);

  // Garage edit modal state
  const [isGarageModalVisible, setIsGarageModalVisible] = useState(false);
  const [garageVehicleType, setGarageVehicleType] = useState<VehicleType>("motorcycle");
  const [garagePlate, setGaragePlate] = useState("");
  const [garageLicense, setGarageLicense] = useState("");
  const [isGarageSaving, setIsGarageSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getRiderProfile();
        if (!mounted) return;
        setProfileData(data);
      } catch (e) {
        if (__DEV__) console.warn("[RiderProfile] Failed to fetch:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const vehicles = useMemo(() => buildVehicles(profileData), [profileData, language]);

  const handleOpenGarage = () => {
    setGarageVehicleType((profileData?.vehicle_type as VehicleType) ?? "motorcycle");
    setGaragePlate(profileData?.vehicle_plate_number ?? "");
    setGarageLicense(profileData?.license_number ?? "");
    setIsGarageModalVisible(true);
  };

  const handleSaveGarage = async () => {
    setIsGarageSaving(true);
    try {
      const updated = await updateRiderProfile({
        vehicle_type: garageVehicleType,
        vehicle_plate_number: garagePlate.trim() || null,
        license_number: garageLicense.trim() || null,
      });
      setProfileData(updated);
      setIsGarageModalVisible(false);
    } catch (e: any) {
      Alert.alert(t("common.error"), t("profile.saveVehicleFailed"));
    } finally {
      setIsGarageSaving(false);
    }
  };

  const activeVehicle = useMemo(
    () => vehicles[activeVehicleIndex] ?? vehicles[0],
    [vehicles, activeVehicleIndex],
  );

  const handleLogout = () => {
    Alert.alert(t("profile.logoutTitle"), t("profile.logoutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.logout"),
        style: "destructive",
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.headerSurface, { paddingTop: insets.top + 8 }]}>
            {/* Burger menu removed — settings list below covers everything */}

            <View style={styles.avatarWithBadge}>
              <SaganaImage
                source={
                  profileData?.profile_image
                    ? { uri: profileData.profile_image }
                    : PROFILE_IMAGE
                }
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={styles.cameraBadge}>
                <MaterialIcons
                  name={IconTheme.camera}
                  size={13}
                  color={colors.textDark}
                />
              </View>
            </View>
            <Text style={styles.userName}>
              {profileData?.name ?? t("common.loading")}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {profileData ? `${profileData.rating.toFixed(1)}` : "—"}
              </Text>
              <Text style={styles.statLabel}>{t("profile.rating")}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {profileData?.total_deliveries ?? "—"}
              </Text>
              <Text style={styles.statLabel}>{t("profile.deliveries")}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {profileData ? `${profileData.on_time_rate}%` : "—"}
              </Text>
              <Text style={styles.statLabel}>{t("profile.onTime")}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.promoCard}
            onPress={() => null}
            accessibilityRole="button"
            accessibilityLabel="Open sagana card"
          >
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>{t("common.comingSoon")}</Text>
            </View>
            <SaganaImage
              source={SAGANA_LOGO}
              style={styles.promoLogo}
              contentFit="contain"
            />
            <Text style={styles.promoSubtitle}>
              {t("profile.promo")}
            </Text>
          </TouchableOpacity>

          <View style={styles.garageWrap}>
            <View style={styles.garageHeaderRow}>
              <Text style={styles.garageTitle}>{t("profile.garage")}</Text>
              <Pressable
                onPress={handleOpenGarage}
                accessibilityRole="button"
                accessibilityLabel="Edit vehicle details"
              >
                <MaterialIcons
                  name={IconTheme.more}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={280}
              decelerationRate="fast"
              contentContainerStyle={styles.garagePagerContent}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(
                  event.nativeEvent.contentOffset.x / 280,
                );
                setActiveVehicleIndex(
                  Math.max(0, Math.min(vehicles.length - 1, nextIndex)),
                );
              }}
            >
              {vehicles.map((vehicle) => (
                <View key={vehicle.id} style={styles.vehicleSlide}>
                  <View style={styles.vehicleIconCircle}>
                    <MaterialIcons
                      name={vehicle.icon}
                      size={22}
                      color={colors.text}
                    />
                  </View>
                  <View style={styles.vehicleTextWrap}>
                    <Text style={styles.vehicleTitle}>{vehicle.title}</Text>
                    <Text style={styles.vehicleSubtitle}>
                      {vehicle.subtitle}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.garageDotsRow}>
              {vehicles.map((vehicle, index) => (
                <View
                  key={vehicle.id}
                  style={[
                    styles.garageDot,
                    index === activeVehicleIndex
                      ? styles.garageDotActive
                      : null,
                  ]}
                />
              ))}
            </View>

            <View style={styles.garageDivider} />
            <View style={styles.garageTagsRow}>
              <TouchableOpacity style={styles.garageTag} onPress={() => null}>
                <MaterialIcons
                  name={IconTheme.shieldCheck}
                  size={11}
                  color={colors.success}
                />
                <Text style={styles.garageTagText}>{t("profile.license")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.garageTag} onPress={() => null}>
                <MaterialIcons
                  name={IconTheme.shieldCheck}
                  size={11}
                  color={colors.success}
                />
                <Text style={styles.garageTagText}>{t("profile.registration")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => router.push("/tabs/EditProfilePage" as never)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.edit}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.editProfile")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Password and security"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.lock}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.passwordSecurity")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Vouchers"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.tag}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.vouchers")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Refer a rider"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name="card-giftcard"
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.referRider")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Terms and conditions"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.infoCircle}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.terms")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.bell}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.notifications")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setIsLanguageModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Language"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.language}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.language")}</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>
                  {LANGUAGES.find((option) => option.id === language)?.label}
                </Text>
                <MaterialIcons
                  name={IconTheme.chevronRight}
                  size={14}
                  color={colors.textSubtle}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setIsTextSizeModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Text size"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name="format-size"
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.textSize")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Report a problem"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name="report-problem"
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.reportProblem")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Help"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.help}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.help")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Legal and policies"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name="description"
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>{t("profile.legal")}</Text>
              </View>
              <MaterialIcons
                name={IconTheme.chevronRight}
                size={14}
                color={colors.textSubtle}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.logout}
                    size={15}
                    color={colors.error}
                  />
                </View>
                <Text style={styles.logoutLabel}>{t("profile.logout")}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isLanguageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLanguageModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsLanguageModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => null}>
            <Text style={styles.modalTitle}>{t("profile.chooseLanguage")}</Text>
            <View style={styles.modalOptionsList}>
              {LANGUAGES.map((option, index) => {
                const isSelected = language === option.id;
                const isLastItem = index === LANGUAGES.length - 1;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.modalOptionRow,
                      isLastItem ? styles.modalOptionRowLast : null,
                    ]}
                    onPress={() => {
                      setLanguage(option.id);
                      setIsLanguageModalVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected ? styles.modalOptionTextSelected : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <MaterialIcons
                        name={IconTheme.check}
                        size={16}
                        color={colors.success}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isTextSizeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTextSizeModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsTextSizeModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => null}>
            <Text style={styles.modalTitle}>{t("profile.chooseTextSize")}</Text>
            <View style={styles.modalOptionsList}>
              {TEXT_SIZE_OPTIONS.map((option, index) => {
                const isSelected = selectedTextSize === option.label;
                const isLastItem = index === TEXT_SIZE_OPTIONS.length - 1;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.modalOptionRow,
                      isLastItem ? styles.modalOptionRowLast : null,
                    ]}
                    onPress={() => {
                      setSelectedTextSize(option.label);
                      setIsTextSizeModalVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t(option.label)}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isSelected ? styles.modalOptionTextSelected : null,
                      ]}
                    >
                      {t(option.label)}
                    </Text>
                    {isSelected ? (
                      <MaterialIcons
                        name={IconTheme.check}
                        size={16}
                        color={colors.success}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Garage edit modal — vehicle info only (no overlap with Edit Profile) */}
      <Modal
        visible={isGarageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGarageModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsGarageModalVisible(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => null}>
            <Text style={styles.modalTitle}>{t("profile.editVehicle")}</Text>

            {/* Vehicle type chips */}
            <Text style={styles.garageModalLabel}>{t("profile.vehicleType")}</Text>
            <View style={styles.garageModalChipsRow}>
              {(Object.keys(VEHICLE_LABELS) as VehicleType[]).map((value) => {
                const opt = { value, label: t(VEHICLE_LABELS[value]) };
                const isSelected = garageVehicleType === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.garageModalChip,
                      isSelected ? styles.garageModalChipActive : null,
                    ]}
                    onPress={() => setGarageVehicleType(opt.value as VehicleType)}
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                  >
                    <Text
                      style={[
                        styles.garageModalChipText,
                        isSelected ? styles.garageModalChipTextActive : null,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Plate number */}
            <Text style={styles.garageModalLabel}>{t("profile.plateNumber")}</Text>
            <TextInput
              style={styles.garageModalInput}
              value={garagePlate}
              onChangeText={setGaragePlate}
              placeholder="ABC-1234"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            {/* License number */}
            <Text style={styles.garageModalLabel}>{t("profile.licenseNumber")}</Text>
            <TextInput
              style={styles.garageModalInput}
              value={garageLicense}
              onChangeText={setGarageLicense}
              placeholder="LIC-00000"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            {/* Save button */}
            <Pressable
              style={[styles.garageModalSave, isGarageSaving ? { opacity: 0.6 } : null]}
              onPress={handleSaveGarage}
              disabled={isGarageSaving}
              accessibilityRole="button"
              accessibilityLabel="Save vehicle details"
            >
              {isGarageSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.garageModalSaveText}>{t("profile.saveVehicle")}</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
