import { fontFamily, fontWeight } from "@/constants/FontTheme";
import { useColors } from "@/hooks/useColors";
import { StyleSheet } from "react-native";

export const stylesFactory = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.background,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 16,
      color: colors.textDark,
    },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 120,
    },
    avatarSection: {
      alignItems: "center",
      paddingVertical: 20,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: colors.border,
    },
    avatarHint: {
      marginTop: 8,
      fontFamily: fontFamily.regular,
      fontWeight: fontWeight.regular,
      fontSize: 10,
      color: colors.textMuted,
    },
    sectionTitle: {
      marginTop: 20,
      marginBottom: 8,
      fontFamily: fontFamily.semiBold,
      fontWeight: fontWeight.semiBold,
      fontSize: 13,
      color: colors.textDark,
    },
    fieldGroup: {
      backgroundColor: colors.backgroundSoft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    fieldRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 48,
    },
    fieldLabel: {
      fontFamily: fontFamily.medium,
      fontWeight: fontWeight.medium,
      fontSize: 12,
      color: colors.textDark,
    },
    fieldInput: {
      flex: 1,
      textAlign: "right",
      fontFamily: fontFamily.regular,
      fontWeight: fontWeight.regular,
      fontSize: 12,
      color: colors.text,
      padding: 0,
      marginLeft: 12,
    },
    fieldDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 14,
    },
    vehicleOptionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    vehicleChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    vehicleChipActive: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    vehicleChipText: {
      fontFamily: fontFamily.medium,
      fontWeight: fontWeight.medium,
      fontSize: 10,
      color: colors.textMuted,
    },
    vehicleChipTextActive: {
      color: colors.white,
    },
    saveButton: {
      marginTop: 24,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 14,
      color: colors.white,
    },
  });