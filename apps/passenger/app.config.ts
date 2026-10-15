import type { ExpoConfig } from 'expo/config';

const googleMapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY;

// Usage strings say what the app does, in French (DRV-15). The photo library serves documents and support attachments.
const CAMERA_USAGE = 'Naya utilise l’appareil photo pour votre selfie et vos pièces justificatives, uniquement pendant la vérification.';
const NO_BACKGROUND_USAGE = 'Naya n’utilise pas votre position en arrière-plan ; elle sert seulement pendant que l’app est ouverte.';
const PHOTOS_USAGE = 'Naya accède à vos photos seulement si vous choisissez d’importer une pièce justificative ou de joindre une image à une demande d’assistance.';

const config: ExpoConfig = {
  name: 'Naya',
  slug: 'naya-passagere',
  scheme: 'naya',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FAF4F7',
  ios: {
    bundleIdentifier: 'ma.naya.passagere',
    appleTeamId: '89884BGNZR',
    supportsTablet: false,
    userInterfaceStyle: 'automatic',
    buildNumber: '4',
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'ma.naya.passagere',
    adaptiveIcon: { backgroundColor: '#6B3657', foregroundImage: './assets/android-icon-foreground.png', monochromeImage: './assets/android-icon-monochrome.png' },
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
    // The « Always » keys stay declared (expo-location links those APIs) but say the truth: never in the background.
    // CoreMotion is linked too: French string instead of the English default.
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Naya utilise votre position pour proposer votre point de départ. Vous pouvez aussi le choisir sur la carte.',
        locationAlwaysAndWhenInUsePermission: NO_BACKGROUND_USAGE,
        locationAlwaysPermission: NO_BACKGROUND_USAGE,
        motionUsagePermission: 'Naya n’utilise pas les données de mouvement de votre téléphone.',
      },
    ],
    'expo-apple-authentication',
  ],
};

export default config;
