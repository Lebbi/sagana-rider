import { stylesFactory } from "@/features/riders/presentation/styles/RiderProfile.styles";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { getRiderProfile, type RiderProfileData } from "@/lib/riderProfileApi";

interface SelectionOption {
  id: string;
  label: string;
}

interface RiderVehicle {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const PROFILE_IMAGE = require("@/assets/images/default-avatar.png");
const SAGANA_LOGO = require("@/assets/branding/sagana-wordform-logo.png");

const LANGUAGE_OPTIONS: SelectionOption[] = [
  { id: "english-us", label: "English (US)" },
  { id: "tagalog", label: "Tagalog" },
  { id: "kapampangan", label: "Kapampangan" },
];

const TEXT_SIZE_OPTIONS: SelectionOption[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
  { id: "extra-large", label: "Xtra Large" },
];

// Build the garage list from the rider's real profile data (single vehicle
// per rider in v1) — falls back to a neutral placeholder while loading.
function buildVehicles(profile: RiderProfileData | null): RiderVehicle[] {
  if (!profile || !profile.vehicle_type) {
    return [
      {
        id: "vehicle-none",
        title: "No vehicle on file",
        subtitle: "Contact Sagana support",
        icon: "two-wheeler" as keyof typeof MaterialIcons.glyphMap,
      },
    ];
  }
  const label =
    profile.vehicle_type.charAt(0).toUpperCase() +
    profile.vehicle_type.slice(1);
  const plate = profile.vehicle_plate_number
    ? `Plate: ${profile.vehicle_plate_number}`
    : "Plate not registered";
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
  const router = useRouter();
  const { logout } = useUser();

  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [isDarkModeEnabled, setIsDarkModeEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("English (US)");
  const [selectedTextSize, setSelectedTextSize] = useState("Medium");
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isTextSizeModalVisible, setIsTextSizeModalVisible] = useState(false);
  const [profileData, setProfileData] = useState<RiderProfileData | null>(null);

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

  const vehicles = useMemo(() => buildVehicles(profileData), [profileData]);

  const activeVehicle = useMemo(
    () => vehicles[activeVehicleIndex] ?? vehicles[0],
    [vehicles, activeVehicleIndex],
  );

  const handleLogout = () => {
    Alert.alert("Log out?", "You will need to log in again to continue.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSurface}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Open profile menu"
            >
              <MaterialIcons
                name={IconTheme.menu}
                size={20}
                color={colors.textDark}
              />
            </TouchableOpacity>

            <View style={styles.avatarWithBadge}>
              <Image
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
              {profileData?.name ?? "Loading..."}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {profileData ? `${profileData.rating.toFixed(1)}` : "—"}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {profileData?.total_deliveries ?? "—"}
              </Text>
              <Text style={styles.statLabel}>Deliveries</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {profileData ? `${profileData.on_time_rate}%` : "—"}
              </Text>
              <Text style={styles.statLabel}>On-Time</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.promoCard}
            onPress={() => null}
            accessibilityRole="button"
            accessibilityLabel="Open sagana card"
          >
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>Coming Soon</Text>
            </View>
            <Image
              source={SAGANA_LOGO}
              style={styles.promoLogo}
              contentFit="contain"
            />
            <Text style={styles.promoSubtitle}>
              Unlock advanced analytics, farm-direct bidding, and premium
              harvest reports
            </Text>
          </TouchableOpacity>

          <View style={styles.garageWrap}>
            <View style={styles.garageHeaderRow}>
              <Text style={styles.garageTitle}>Garage</Text>
              <MaterialIcons
                name={IconTheme.more}
                size={18}
                color={colors.textMuted}
              />
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
                <Text style={styles.garageTagText}>License</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.garageTag} onPress={() => null}>
                <MaterialIcons
                  name={IconTheme.shieldCheck}
                  size={11}
                  color={colors.success}
                />
                <Text style={styles.garageTagText}>Registration</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => null}
              accessibilityRole="button"
              accessibilityLabel="Edit profile (coming soon)"
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.edit}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>Edit Profile</Text>
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
                <Text style={styles.settingLabel}>Password & Security</Text>
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
                <Text style={styles.settingLabel}>Vouchers</Text>
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
                <Text style={styles.settingLabel}>Refer a Rider</Text>
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
                <Text style={styles.settingLabel}>Terms and Conditions</Text>
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
                <Text style={styles.settingLabel}>Notifications</Text>
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
                <Text style={styles.settingLabel}>Language</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>{selectedLanguage}</Text>
                <MaterialIcons
                  name={IconTheme.chevronRight}
                  size={14}
                  color={colors.textSubtle}
                />
              </View>
            </TouchableOpacity>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconCircle}>
                  <MaterialIcons
                    name={IconTheme.moon}
                    size={15}
                    color={colors.success}
                  />
                </View>
                <Text style={styles.settingLabel}>Dark Mode</Text>
              </View>
              <Switch
                value={isDarkModeEnabled}
                onValueChange={setIsDarkModeEnabled}
                thumbColor={isDarkModeEnabled ? colors.success : undefined}
                trackColor={{
                  false: "#D0D0D0",
                  true: colors.success ? `${colors.success}88` : undefined,
                }}
              />
            </View>
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
                <Text style={styles.settingLabel}>Text Size</Text>
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
                <Text style={styles.settingLabel}>Report a problem</Text>
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
                <Text style={styles.settingLabel}>Help</Text>
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
                <Text style={styles.settingLabel}>Legal & policies</Text>
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
                <Text style={styles.logoutLabel}>Log out</Text>
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
            <Text style={styles.modalTitle}>Choose Language</Text>
            <View style={styles.modalOptionsList}>
              {LANGUAGE_OPTIONS.map((option, index) => {
                const isSelected = selectedLanguage === option.label;
                const isLastItem = index === LANGUAGE_OPTIONS.length - 1;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.modalOptionRow,
                      isLastItem ? styles.modalOptionRowLast : null,
                    ]}
                    onPress={() => {
                      setSelectedLanguage(option.label);
                      setIsLanguageModalVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${option.label}`}
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
            <Text style={styles.modalTitle}>Choose Text Size</Text>
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
                    accessibilityLabel={`Select ${option.label}`}
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
    </View>
  );
}
