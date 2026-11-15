// metro.config.js — Sagana Rider
// Simple default config. The worklets web-shim from the main app is not
// needed yet (no web target for riders); add it back if web support lands.
// Sentry's Expo config adds debug ids so crash reports can map to source (OPS-11).
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;