// app/index.tsx — Sagana Rider placeholder (Phase 4 replaces with login/token gate)
import { StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sagana Rider</Text>
      <Text style={styles.subtitle}>Scaffold v1 — rider app extraction in progress</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D7ECC1",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#087434",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#2c5938",
  },
});