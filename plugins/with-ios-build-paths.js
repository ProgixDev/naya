// Expo SDK 57's Constants phase and React Native bundle invocation assume
// paths contain no spaces. Keep the workaround in prebuild configuration.
const { withPodfile, withXcodeProject } = require('expo/config-plugins');

const constantsScript = `set -eo pipefail
PROJECT_ROOT="\${PROJECT_ROOT:-"$PROJECT_DIR/../.."}"
case "$BUNDLE_FORMAT" in
  shallow) RESOURCE_DEST="$CONFIGURATION_BUILD_DIR/EXConstants.bundle" ;;
  deep) RESOURCE_DEST="$CONFIGURATION_BUILD_DIR/EXConstants.bundle/Contents/Resources" ;;
  *) echo "Unsupported bundle format: $BUNDLE_FORMAT" >&2; exit 1 ;;
esac
mkdir -p "$RESOURCE_DEST"
bash "$PODS_TARGET_SRCROOT/../scripts/with-node.sh" "$PODS_TARGET_SRCROOT/../scripts/getAppConfig.js" "$PROJECT_ROOT" "$RESOURCE_DEST"
`;

const podHook = `
    # Naya: quote Expo Constants paths, including project roots with spaces.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'EXConstants'
      target.shell_script_build_phases.each do |phase|
        next unless phase.name.include?('Generate app.config')
        phase.shell_script = <<~'NAYA_CONSTANTS_SCRIPT'
${constantsScript}NAYA_CONSTANTS_SCRIPT
      end
    end
`;

module.exports = function withIosBuildPaths(config) {
  config = withPodfile(config, (c) => {
    if (!c.modResults.contents.includes('NAYA_CONSTANTS_SCRIPT')) {
      const anchor = '  post_install do |installer|';
      if (!c.modResults.contents.includes(anchor)) throw new Error('Missing CocoaPods post_install hook');
      c.modResults.contents = c.modResults.contents.replace(anchor, anchor + podHook);
    }
    return c;
  });
  return withXcodeProject(config, (c) => {
    for (const phase of Object.values(c.modResults.hash.project.objects.PBXShellScriptBuildPhase || {})) {
      if (!phase || typeof phase !== 'object' || !phase.shellScript) continue;
      if (!phase.shellScript.includes('/scripts/react-native-xcode.sh')) continue;
      const script = phase.shellScript.startsWith('"')
        ? JSON.parse(phase.shellScript.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'))
        : phase.shellScript;
      // Execute the resolved script as one quoted argument instead of a bare
      // command substitution, which splits paths at whitespace.
      const fixed = script.replace(/`("\$NODE_BINARY" --print [^\n]+)`/g, 'bash "$($1)"');
      phase.shellScript = JSON.stringify(fixed);
    }
    return c;
  });
};
