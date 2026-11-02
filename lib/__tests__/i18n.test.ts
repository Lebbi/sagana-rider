import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { en } from "../i18n/en";
import { pam } from "../i18n/pam";
import { tl } from "../i18n/tl";
import { getLanguage, loadLanguage, setLanguage, t, type TextKey } from "../i18n";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");

beforeEach(async () => {
  await AsyncStorage.clear();
  setLanguage("en");
});

describe("t", () => {
  it("shows the chosen language and falls back to English for a missing entry", () => {
    const keys = Object.keys(en) as TextKey[];
    const translated = keys.find((k) => tl[k]);
    expect(translated).toBeDefined();
    setLanguage("tl");
    expect(t(translated!)).toBe(tl[translated!]);

    const missing = "test.onlyInEnglish" as TextKey;
    (en as Record<string, string>)[missing] = "Only English";
    expect(t(missing)).toBe("Only English");
    delete (en as Record<string, string>)[missing];
  });

  it("fills in values by name", () => {
    const key = (Object.keys(en) as TextKey[]).find((k) => /\{\w+\}/.test(en[k]));
    expect(key).toBeDefined();
    const names = en[key!].match(/\{(\w+)\}/g)!.map((p) => p.slice(1, -1));
    const out = t(key!, Object.fromEntries(names.map((n) => [n, "VALUE"])));
    expect(out).not.toMatch(/\{\w+\}/);
    expect(out).toContain("VALUE");
  });
});

describe("language choice", () => {
  it("survives a restart", async () => {
    setLanguage("pam");
    await Promise.resolve();
    expect(await AsyncStorage.getItem("sagana.language")).toBe("pam");
    setLanguage("en");
    await AsyncStorage.setItem("sagana.language", "pam");
    await loadLanguage();
    expect(getLanguage()).toBe("pam");
  });

  it("ignores an unknown saved value", async () => {
    await AsyncStorage.setItem("sagana.language", "fr");
    await loadLanguage();
    expect(getLanguage()).toBe("en");
  });
});

describe.each([
  ["Tagalog", tl],
  ["Kapampangan", pam],
])("%s file", (_name, dict) => {
  it("has no blank entries, no unknown keys, and the same placeholders as English", () => {
    for (const [key, text] of Object.entries(dict)) {
      expect(key in en).toBe(true);
      expect(text?.trim()).toBeTruthy();
      expect(placeholders(text!)).toBe(placeholders(en[key as TextKey]));
    }
  });
});
