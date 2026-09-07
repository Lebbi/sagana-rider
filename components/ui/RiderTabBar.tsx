/**
 * components/ui/RiderTabBar.tsx — Sagana Rider
 *
 * Single-role tab bar for the rider app. Matches the main app's
 * NavigationBar visual language (same tokens, same icon set) but with
 * no role switching — the rider app is always in rider mode.
 *
 * Tabs: Home | Active | Orders | Wallet | Profile
 */

import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { fontFamily } from "@/constants/FontTheme";
import { useColors } from "@/hooks/useColors";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const fontFamilySemiBold = fontFamily.semiBold;
const fontFamilyMedium = fontFamily.medium;

interface TabItem {
  key: string;
  label: string;
  icon: keyof typeof IconTheme;
  route: string;
}

const RIDER_TABS: TabItem[] = [
  { key: "home", label: "Home", icon: "home", route: "index" },
  { key: "active", label: "Active", icon: "sync", route: "ActiveDeliveryPage" },
  { key: "orders", label: "Orders", icon: "orders", route: "RiderOrdersPage" },
  { key: "wallet", label: "Wallet", icon: "wallet", route: "RiderWalletPage" },
  { key: "profile", label: "Profile", icon: "profile", route: "RiderProfile" },
];

// Screens where the tab bar is hidden (focused delivery modes)
const HIDDEN_ROUTES = new Set(["ActiveDeliveryPage", "PasabayNavigationScreen"]);

interface RiderTabBarProps {
  state: {
    index: number;
    routes: { name: string; key: string }[];
  };
  navigation: {
    emit: (event: { type: string; target?: string; data?: unknown }) => boolean;
    navigate: (name: string) => void;
  };
}

function getFocusedRouteName(props: RiderTabBarProps): string {
  const state = props.state;
  if (!state?.routes?.[state.index]) return "";
  return state.routes[state.index].name;
}

export default function RiderTabBar(props: RiderTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const activeRoute = getFocusedRouteName(props);

  const activeIndex = useMemo(() => {
    const i = RIDER_TABS.findIndex((t) => t.route === activeRoute);
    return i >= 0 ? i : 0;
  }, [activeRoute]);

  const handleTabPress = (route: string) => {
    // "index" is the implicit root of the tabs group
    const path = route === "index" ? "/tabs" : `/tabs/${route}`;
    router.push(path as never);
  };

  if (activeRoute && HIDDEN_ROUTES.has(activeRoute)) {
    return null;
  }

  const activeTint = colors.primary;
  const inactiveTint = colors.textMuted;

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, 4),
        },
      ]}
    >
      <View style={styles.row}>
        {RIDER_TABS.map((item, index) => {
          const isActive = index === activeIndex;
          const tint = isActive ? activeTint : inactiveTint;
          return (
            <Pressable
              key={item.key}
              style={styles.tabButton}
              onPress={() => handleTabPress(item.route)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} tab`}
              accessibilityState={{ selected: isActive }}
            >
              <MaterialIcons
                name={IconTheme[item.icon]}
                size={22}
                color={tint}
              />
              <View style={styles.labelWrap}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: tint,
                      fontFamily: isActive
                        ? fontFamilySemiBold
                        : fontFamilyMedium,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopColor: "transparent",
    paddingTop: 2,
  },
  row: {
    flexDirection: "row",
  },
  tabButton: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  labelWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    includeFontPadding: false,
    textAlign: "center",
  },
});