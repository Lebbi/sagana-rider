import type { ConfigContext, ExpoConfig } from "expo/config";

// Runtime version = app version, so an update never reaches a build with other native code. A plain string,
// not the appVersion policy: Expo CLI calls a folder with android/ bare and rejects policies in `expo start`.
// Bump version on any native change.
export default ({ config }: ConfigContext): ExpoConfig => ({ ...(config as ExpoConfig), runtimeVersion: config.version });
