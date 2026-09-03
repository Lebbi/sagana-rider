// metro.config.js — Sagana Rider
// Simple default config. The worklets web-shim from the main app is not
// needed yet (no web target for riders); add it back if web support lands.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;