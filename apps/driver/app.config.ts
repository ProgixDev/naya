import type { ExpoConfig } from 'expo/config';

const googleMapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY;

// Usage strings say what the app does, in French (DRV-15, DRV-16). The camera also takes the Famille pickup and
// drop-off photos; the photo library serves documents and support attachments.
const CAMERA_USAGE = 'Naya utilise l’appareil photo pour votre selfie et vos pièces justificatives, et pour les photos de prise en charge et de dépôt des trajets Famille.';
const ALWAYS_USAGE = 'Pendant une course acceptée, Naya partage votre position avec la passagère, même écran verrouillé. Le partage s’arrête à la fin de la course.';
const MOTION_USAGE = 'Naya n’utilise pas les données de mouvement de votre téléphone.';
const PHOTOS_USAGE = 'Naya accède à vos photos seulement si vous choisissez d’importer une pièce justificative ou de joindre une image à une demande d’assistance.';

const config: ExpoConfig = {
  name: 'Naya Chauffeuse',
  slug: 'naya-chauffeuse',
  scheme: 'naya-chauffeuse',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FAF4F7',
  ios: {
    bundleIdentifier: 'ma.naya.chauffeuse',
    appleTeamId: '89884BGNZR',
    supportsTablet: false,
    userInterfaceStyle: 'automatic',
    buildNumber: '5',
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'ma.naya.chauffeuse',
    adaptiveIcon: { backgroundColor: '#FFFFFF', foregroundImage: './assets/android-icon-foreground.png', monochromeImage: './assets/android-icon-monochrome.png' },
    predictiveBackGestureEnabled: false,
    userInterfaceStyle: 'automatic',
    // Without a key the app uses the tile-based fallback map (see src/features/map).
    ...(googleMapsKey ? { config: { googleMaps: { apiKey: googleMapsKey } } } : {}),
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  experiments: { typedRoutes: true },
  extra: { googleMapsConfigured: !!googleMapsKey },
  plugins: [
    // iOS 27 requires the UIScene life cycle; see plugins/with-scene-lifecycle.js.
    '../../plugins/with-scene-lifecycle',
    '../../plugins/with-ios-build-paths',
    'expo-router',
    ['expo-secure-store', { faceIDPermission: 'Naya utilise Face ID uniquement si vous choisissez de protéger l’accès à votre compte.' }],
    'expo-web-browser',
    // Dark phones get the dark background (darkColors.background in packages/tokens) from the first frame.
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 120, backgroundColor: '#FAF4F7', dark: { backgroundColor: '#16121A', image: './assets/splash-icon.png' } }],
    'expo-font',
    'expo-image',
    // Photos only, never video: no microphone prompt or RECORD_AUDIO (DRV-15). image-picker's `false` also blocks
    // RECORD_AUDIO for every other package. The camera string is repeated so the plugin order cannot fall back to English.
    ['expo-camera', { cameraPermission: CAMERA_USAGE, microphonePermission: false, recordAudioAndroid: false }],
    ['expo-image-picker', { photosPermission: PHOTOS_USAGE, cameraPermission: CAMERA_USAGE, microphonePermission: false }],
    ['expo-notifications', { color: '#6B3657' }],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Quand vous êtes en ligne ou en course, Naya utilise votre position pour vous proposer des courses proches et montrer votre arrivée à la passagère.',
        // Asked only after BackgroundLocationExplainer on an accepted ride (DRV-16); refused = foreground sharing.
        locationAlwaysAndWhenInUsePermission: ALWAYS_USAGE,
        // Legacy key, and CoreMotion is linked by expo-location: keep both in French rather than the English defaults.
        locationAlwaysPermission: ALWAYS_USAGE,
        motionUsagePermission: MOTION_USAGE,
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
  ],
};

export default config;
