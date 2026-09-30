// iOS 27 (Xcode 27 SDK) traps at launch unless the app adopts the UIScene life cycle
// (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`, SIGTRAP). Expo SDK 57 ships
// `ExpoAppSceneDelegate` for this, but the SDK 57 prebuild template still generates the
// window-in-AppDelegate code. This plugin wires the scene delegate in, keeping ios/ generated.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

function withSceneLifecycle(config) {
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') throw new Error('with-scene-lifecycle expects a Swift AppDelegate');
    let src = c.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
      // The scene delegate creates the window from the connecting UIWindowScene and starts React Native in it.
      src = src.replace(/#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/, '');
    }
    c.modResults.contents = src;
    return c;
  });
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{ UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' }],
      },
    };
    return c;
  });
}

module.exports = withSceneLifecycle;
