// app/tabs/(riders)/presentation/styles/RiderOrdersPage.styles.ts
import { fontFamily, fontWeight } from "@/constants/FontTheme";
import { useColors } from "@/hooks/useColors";
import { StyleSheet } from "react-native";

export const stylesFactory = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      backgroundColor: colors.primaryContainer,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 41 / 2,
      color: colors.text,
    },
    tabsWrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      backgroundColor: colors.background,
    },
    tabButton: {
      flex: 1,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    tabLabel: {
      fontFamily: fontFamily.medium,
      fontWeight: fontWeight.medium,
      fontSize: 10,
      color: colors.textDark,
    },
    tabLabelActive: {
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      color: colors.success,
    },
    tabsDivider: {
      height: 2,
      backgroundColor: "rgba(0, 0, 0, 0.26)",
      position: "relative",
    },
    tabsIndicator: {
      position: "absolute",
      bottom: 0,
      height: 3,
      width: "20%",
      backgroundColor: colors.success,
      borderRadius: 2,
    },
    content: {
      padding: 14,
      gap: 10,
      paddingBottom: 120,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 11,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    orderText: {
      fontFamily: fontFamily.semiBold,
      fontWeight: fontWeight.semiBold,
      fontSize: 12,
      color: colors.success,
    },
    dateText: {
      marginTop: 2,
      fontFamily: fontFamily.semiBold,
      fontWeight: fontWeight.semiBold,
      fontSize: 8,
      color: colors.textMuted,
    },
    cardDivider: {
      marginTop: 10,
      marginBottom: 8,
      height: 1,
      backgroundColor: "rgba(0, 0, 0, 0.26)",
    },
    shippingText: {
      fontFamily: fontFamily.semiBold,
      fontWeight: fontWeight.semiBold,
      fontSize: 11,
      color: colors.text,
    },
    statusChip: {
      borderRadius: 9,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    statusChipCompleted: {
      backgroundColor: "#57A77A",
    },
    statusChipProcessing: {
      backgroundColor: "#D59A2E",
    },
    statusChipNew: {
      backgroundColor: "#4C8AE7",
    },
    statusChipText: {
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 8 / 2,
      letterSpacing: 0.6,
      color: colors.white,
    },
    emptyWrap: {
      marginTop: 30,
      alignItems: "center",
    },
    emptyText: {
      fontFamily: fontFamily.semiBold,
      fontWeight: fontWeight.semiBold,
      fontSize: 11,
      color: colors.textMuted,
    },
  });
