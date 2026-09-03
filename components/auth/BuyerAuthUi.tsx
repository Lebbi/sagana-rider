// components/auth/BuyerAuthUi.tsx
// Decorative corner ornaments for the buyer auth screens.

import { StyleSheet, View } from "react-native";

import { buyerLoginDesign as d } from "@/constants/buyerLoginDesign";

export function AuthCornerOrnaments() {
  return (
    <>
      <View style={[styles.ornament, styles.topLeft]} />
      <View style={[styles.ornament, styles.bottomRight]} />
    </>
  );
}

const styles = StyleSheet.create({
  ornament: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: d.primary,
    opacity: 0.08,
  },
  topLeft: {
    top: -40,
    left: -40,
  },
  bottomRight: {
    bottom: -40,
    right: -40,
  },
});
