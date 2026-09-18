module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // reanimated 4.x moved its babel transform into react-native-worklets;
    // the old 'react-native-reanimated/plugin' path throws on 4.5.1 and
    // crashes release bundles (dev/Metro tolerated it).
    plugins: ["react-native-worklets/plugin"],
  };
};