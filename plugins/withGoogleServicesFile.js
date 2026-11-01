// plugins/withGoogleServicesFile.js
//
// Points the Android build at the google-services.json supplied by the
// GOOGLE_SERVICES_JSON EAS file variable. Without it the build keeps working,
// but Android push stays off.

module.exports = function withGoogleServicesFile(config) {
  const file = process.env.GOOGLE_SERVICES_JSON;
  if (file) config.android = { ...config.android, googleServicesFile: file };
  return config;
};
