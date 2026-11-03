// components/auth/BuyerAuthUi.tsx
// Shared pieces of the rider auth screens (log in, apply): corner ornaments,
// text, inputs, and a labelled field with its error line.

import { type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
} from "react-native";

import { buyerLoginDesign as d, manrope } from "@/constants/buyerLoginDesign";

export function AuthCornerOrnaments() {
  return (
    <>
      <View style={[styles.ornament, styles.topLeft]} />
      <View style={[styles.ornament, styles.bottomRight]} />
    </>
  );
}

export function LoginText({ style, ...rest }: TextProps) {
  return <Text style={[styles.manropeBase, style]} {...rest} />;
}

export function LoginTextInput({ style, ...rest }: TextInputProps) {
  return (
    <TextInput
      style={[styles.textInput, style]}
      placeholderTextColor={d.forgotLink}
      {...rest}
    />
  );
}

export function AuthField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.fieldBlock}>
      <LoginText style={styles.fieldLabel}>
        {label}
        {required ? (
          <LoginText style={styles.requiredMark}> *</LoginText>
        ) : null}
      </LoginText>
      {children}
      {error ? <LoginText style={styles.fieldError}>{error}</LoginText> : null}
    </View>
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
  manropeBase: {
    fontFamily: manrope.regular,
  },
  fieldBlock: {
    marginBottom: d.fieldGap,
  },
  fieldLabel: {
    fontFamily: manrope.bold,
    fontSize: d.labelSize,
    color: d.primary,
    marginBottom: d.labelToInput,
  },
  requiredMark: {
    color: d.required,
    fontFamily: manrope.bold,
  },
  textInput: {
    height: d.controlHeight,
    backgroundColor: d.inputBg,
    borderWidth: 1,
    borderColor: d.inputBorder,
    borderRadius: d.radius,
    paddingHorizontal: 14,
    fontFamily: manrope.medium,
    fontSize: d.bodySize,
    color: d.primary,
  },
  fieldError: {
    fontFamily: manrope.regular,
    fontSize: 12,
    color: d.required,
    marginTop: 6,
  },
});
