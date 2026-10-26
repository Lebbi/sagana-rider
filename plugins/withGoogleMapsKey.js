// plugins/withGoogleMapsKey.js
//
// Config plugin that injects the Google Maps Android API key into
// AndroidManifest.xml as a <meta-data> entry inside <application>.
//
// The key is read from the GOOGLE_MAPS_API_KEY environment variable
// (set via EAS secrets). If the key is not set, the plugin is a no-op.
//
// Usage in app.json:
//   "plugins": [..., "./plugins/withGoogleMapsKey"]

const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withGoogleMapsKey(config) {
  config = withAndroidManifest(config, (config) => {
    // Read from environment variable (EAS secrets) or from app.json extra
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || config.exp?.extra?.googleMapsApiKey || "";

    if (!apiKey) {
      console.warn(
        "[withGoogleMapsKey] GOOGLE_MAPS_API_KEY not set — maps will render blank in production.",
      );
      return config;
    }

    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    if (!application["meta-data"]) {
      application["meta-data"] = [];
    }

    application["meta-data"] = application["meta-data"].filter(
      (entry) => entry.$["android:name"] !== "com.google.android.geo.API_KEY",
    );

    application["meta-data"].push({
      $: {
        "android:name": "com.google.android.geo.API_KEY",
        "android:value": apiKey,
      },
    });

    return config;
  });

  // Store the key in app.extra so it can be read at runtime via
  // Constants.extra.googleMapsApiKey. This avoids relying on
  // process.env (injected via EAS secrets) which does not reach the
  // JS bundle. We write to config.exp.extra which is the canonical
  // field for custom extra data in Expo config plugins.
  // Use the same resolution logic: env var first, then config.extra
  const finalApiKey = process.env.GOOGLE_MAPS_API_KEY || config.exp?.extra?.googleMapsApiKey || "";
  if (finalApiKey) {
    config.exp = {
      ...config.exp,
      extra: {
        ...config.exp?.extra,
        googleMapsApiKey: finalApiKey,
      },
    };
  }

  return config;
};