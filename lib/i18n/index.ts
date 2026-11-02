import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { en } from "./en";
import { tl } from "./tl";

export type Language = "en" | "tl";
export type TextKey = keyof typeof en;
export type Translation = Partial<Record<TextKey, string>>;

export const LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "tl", label: "Tagalog" },
];

const dictionaries: Record<Language, Translation> = { en, tl };
const STORAGE_KEY = "sagana.language";

let current: Language = "en";
const listeners = new Set<() => void>();

const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && value in dictionaries;

export function t(key: TextKey, values?: Record<string, string | number>): string {
  const text = dictionaries[current][key] || en[key];
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export const getLanguage = (): Language => current;

export function setLanguage(language: Language) {
  current = language;
  listeners.forEach((listener) => listener());
  AsyncStorage.setItem(STORAGE_KEY, language).catch(() => {});
}

export async function loadLanguage() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  if (isLanguage(saved) && saved !== current) {
    current = saved;
    listeners.forEach((listener) => listener());
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Re-renders the calling component when the language changes. */
export function useT() {
  useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return t;
}
