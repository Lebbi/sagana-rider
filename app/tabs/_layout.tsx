// app/tabs/_layout.tsx — Sagana Rider
//
// Rider tabs: Home | Active | Orders | Wallet | Profile
// ActiveDeliveryPage + PasabayNavigationScreen are focused delivery
// modes (tab bar hidden via RiderTabBar's HIDDEN_ROUTES).

import { Tabs } from "expo-router";

import RiderTabBar from "@/components/ui/RiderTabBar";
import {
  AutoAcceptBanner,
  AutoAcceptProvider,
} from "@/context/AutoAcceptContext";

export default function RiderTabsLayout() {
  return (
    <AutoAcceptProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props: any) => <RiderTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="ActiveDeliveryPage" options={{ title: "Active" }} />
        <Tabs.Screen
          name="PasabayNavigationScreen"
          options={{ href: null, title: "Pasabay" }}
        />
        <Tabs.Screen name="RiderOrdersPage" options={{ title: "Orders" }} />
        <Tabs.Screen name="RiderWalletPage" options={{ title: "Wallet" }} />
        <Tabs.Screen name="RiderProfile" options={{ title: "Profile" }} />
      </Tabs>
      {/* Countdown chip — fixed above the tab bar, visible from any tab */}
      <AutoAcceptBanner />
    </AutoAcceptProvider>
  );
}