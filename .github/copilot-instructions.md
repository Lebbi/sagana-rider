# Expo project instructions

## MANDATORY: Fetch docs before implementing

**Before writing or modifying any code that touches an Expo, EAS, or React Native API:**

1. Go to https://docs.expo.dev/llms.txt — the full Expo docs page map.
2. Find the page that covers the topic you're about to work with (e.g. `expo-location`, `EAS Update`, `expo-router`).
3. Fetch that page as markdown by appending `.md` to its URL
   (example: https://docs.expo.dev/router/introduction.md).
4. Use the fetched docs as the source of truth — **never guess from training data.**
   Expo ships breaking changes every SDK release; your training data is likely outdated.

This is a hard pre-implementation gate, not a "best effort" suggestion. If you cannot
find a relevant page in llms.txt, say so explicitly before proceeding.

- Full Expo docs page map: https://docs.expo.dev/llms.txt
- When you need Expo or EAS documentation, find the topic in that page map and fetch the
  page as markdown by appending .md to its URL (example: https://docs.expo.dev/router/introduction.md).
  Fetched docs take priority over your training data.
- This project targets the Expo SDK version found in package.json.
- Always install Expo packages with: npx expo install <package>, never npm/yarn install for expo-\* packages.
- Expo uses Continuous Native Generation (CNG): npx expo prebuild + config plugins.
  "Ejecting" does not exist. The global expo-cli is deprecated; use npx expo.
