// NativeWind 4 without `nativewind/babel`: that preset also appends
// `react-native-reanimated/plugin`, but babel-preset-expo (SDK 57) already configures the
// Worklets plugin for Reanimated 4. Keeping only the css-interop transform avoids a
// duplicate animation plugin.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    plugins: [require.resolve('react-native-css-interop/dist/babel-plugin')],
  };
};
