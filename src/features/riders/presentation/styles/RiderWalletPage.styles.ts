// app/tabs/(riders)/presentation/styles/RiderWalletPage.styles.ts
import { useColors } from "@/hooks/useColors";
import { StyleSheet } from "react-native";
import { fontFamily, fontWeight } from "@/constants/FontTheme";

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
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 41 / 2,
      color: colors.text,
    },
    content: {
      padding: 14,
      gap: 10,
    },
    sectionHeading: {
      marginTop: 6,
      marginLeft: 10,
      marginBottom: 6,
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 34 / 2,
      color: colors.text,
    },
    earningsCard: {
      backgroundColor: colors.backgroundMuted,
      borderRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
      marginBottom: 10,
    },
    chartRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      minHeight: 90,
      paddingHorizontal: 2,
    },
    chartColumn: {
      width: 30,
      alignItems: "center",
    },
    chartBarTrack: {
      height: 72,
      width: 23,
      justifyContent: "flex-end",
    },
    chartBar: {
      width: 23,
      borderRadius: 0,
      backgroundColor: colors.success,
    },
    chartDayLabel: {
      marginTop: 4,
      fontFamily: fontFamily.regular,
      fontWeight: fontWeight.regular,
      fontSize: 11,
      color: colors.textMuted,
      letterSpacing: 0.4,
    },
    chartDayLabelActive: {
      color: colors.success,
    },
    chartCaption: {
      marginTop: 8,
      alignSelf: "center",
      fontFamily: fontFamily.medium,
      fontWeight: fontWeight.medium,
      fontSize: 26 / 2,
      color: colors.text,
    },
    balanceCard: {
      backgroundColor: colors.white,
      borderRadius: 14,
      padding: 14,
    },
    balanceLabel: {
      fontFamily: fontFamily.semiBold,
      fontWeight: fontWeight.semiBold,
      fontSize: 11,
      color: colors.textMuted,
    },
    balanceAmount: {
      marginTop: 6,
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 26,
      color: colors.primary,
    },
    balanceSubLabel: {
      marginTop: 4,
      fontFamily: fontFamily.medium,
      fontWeight: fontWeight.medium,
      fontSize: 10,
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 14,
      padding: 14,
    },
    cardTitle: {
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
    },
    cardText: {
      fontFamily: fontFamily.medium,
      fontWeight: fontWeight.medium,
      fontSize: 12,
      color: colors.textDark,
      marginBottom: 2,
    },
  });
