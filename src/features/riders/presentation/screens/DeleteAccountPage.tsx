/**
 * Delete account: the rider confirms with their password and DELETE /api/user
 * anonymises the account. Same flow as the buyer app's DeleteAccount screen.
 */

import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { showSaganaToast } from "@/components/ui/saganaToastConfig";
import { IconTheme, MaterialIcons } from "@/constants/IconTheme";
import { fontFamily, fontWeight } from "@/constants/FontTheme";
import { useUser } from "@/context/UserContext";
import { stylesFactory } from "@/features/riders/presentation/styles/EditProfilePage.styles";
import { useColors } from "@/hooks/useColors";
import { deleteAccount, deleteErrorMessages, isSessionGone } from "@/lib/accountDeletion";
import { useT, type TextKey } from "@/lib/i18n";

const DELETED: TextKey[] = ["account.deletedName", "account.deletedRider", "account.deletedLocation"];
const KEPT: TextKey[] = ["account.keptDeliveries"];

export default function DeleteAccountPage() {
  const colors = useColors();
  const styles = stylesFactory(colors);
  const local = localStylesFactory(colors);
  const router = useRouter();
  const t = useT();
  const { logout } = useUser();

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // State only updates on the next render, too late to stop a double tap.
  const sending = useRef(false);

  const handleDelete = async () => {
    if (!password || sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setErrors([]);

    try {
      await deleteAccount(password);
    } catch (error) {
      if (isSessionGone(error)) {
        await logout();
        Alert.alert(t("account.loggedOutTitle"), t("account.loggedOutBody"));
        return;
      }
      setErrors(deleteErrorMessages(error));
      sending.current = false;
      setSubmitting(false);
      return;
    }

    // logout() clears the stored session and replaces the screen with /login.
    await logout();
    showSaganaToast({ type: "success", text1: t("account.deletedToast") });
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
          >
            <MaterialIcons name={IconTheme.arrowBack} size={22} color={colors.textDark} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("profile.deleteAccount")}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={local.warning}>{t("account.cantUndo")}</Text>

          <Text style={styles.sectionTitle}>{t("account.whatDeleted")}</Text>
          {DELETED.map((item) => (
            <Text key={item} style={local.listItem}>{`• ${t(item)}`}</Text>
          ))}

          <Text style={styles.sectionTitle}>{t("account.whatKept")}</Text>
          {KEPT.map((item) => (
            <Text key={item} style={local.listItem}>{`• ${t(item)}`}</Text>
          ))}

          <Text style={styles.sectionTitle}>{t("account.passwordToConfirm")}</Text>
          <View style={styles.fieldGroup}>
            <View style={styles.fieldRow}>
              <TextInput
                style={[styles.fieldInput, local.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={t("account.password")}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t("account.password")}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>
          </View>

          {errors.length > 0 ? (
            <View style={local.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {errors.map((message) => (
                <Text key={message} style={local.errorText}>
                  {errors.length > 1 ? `• ${message}` : message}
                </Text>
              ))}
            </View>
          ) : null}

          <Pressable
            style={[
              styles.saveButton,
              local.deleteButton,
              !password || submitting ? styles.saveButtonDisabled : null,
            ]}
            onPress={() => void handleDelete()}
            disabled={!password || submitting}
            accessibilityRole="button"
            accessibilityLabel={t("account.deleteMyAccount")}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>{t("account.deleteMyAccount")}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const localStylesFactory = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    warning: {
      marginTop: 8,
      fontFamily: fontFamily.bold,
      fontWeight: fontWeight.bold,
      fontSize: 14,
      color: colors.error,
    },
    listItem: {
      fontFamily: fontFamily.medium,
      fontWeight: fontWeight.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    passwordInput: {
      textAlign: "left",
      marginLeft: 0,
    },
    errorBox: {
      marginTop: 12,
      borderRadius: 10,
      padding: 12,
      gap: 6,
      backgroundColor: colors.errorContainer,
    },
    errorText: {
      fontFamily: fontFamily.medium,
      fontWeight: fontWeight.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.error,
    },
    deleteButton: {
      backgroundColor: colors.error,
    },
  });
