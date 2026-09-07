// app/index.tsx — Sagana Rider root gate
//
// loadingUser → splash; logged in → rider tabs; no session → login.

import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useUser } from "@/context/UserContext";

export default function Index() {
  const { user, loadingUser } = useUser();

  if (loadingUser) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2c5938" />
      </View>
    );
  }

  if (user) {
    return <Redirect href={{ pathname: "/tabs" }} />;
  }

  return <Redirect href={{ pathname: "/login" }} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D7ECC1",
  },
});