import type { ExpoConfig } from 'expo/config';

const googleMapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY;

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
    supportsTablet: false,
    buildNumber: '5',
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'ma.naya.chauffeuse',
    adaptiveIcon: { backgroundColor: '#FFFFFF', foregroundImage: './assets/android-icon-foreground.png', monochromeImage: './assets/android-icon-monochrome.png' },
    predictiveBackGestureEnabled: false,
    // Without a key the app uses the tile-based fallback map (see src/features/map).
    ...(googleMapsKey ? { config: { googleMaps: { apiKey: googleMapsKey } } } : {}),
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  experiments: { typedRoutes: true },
  extra: { googleMapsConfigured: !!googleMapsKey },
  plugins: [
    // iOS 27 requires the UIScene life cycle; see plugins/with-scene-lifecycle.js.
    '../../plugins/with-scene-lifecycle',
    'expo-router',
    ['expo-secure-store', { faceIDPermission: 'Naya utilise Face ID uniquement si vous choisissez de protéger l’accès à votre compte.' }],
    'expo-web-browser',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 120, backgroundColor: '#FAF4F7' }],
    'expo-font',
    'expo-image',
    ['expo-camera', { cameraPermission: 'Naya utilise l’appareil photo pour votre selfie et vos pièces justificatives, uniquement pendant la vérification.' }],
    ['expo-image-picker', { photosPermission: 'Naya accède à vos photos seulement si vous choisissez d’importer une pièce justificative.' }],
    ['expo-notifications', { color: '#6B3657' }],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Naya utilise votre position pour vous proposer des courses proches et guider la passagère vers vous.',
        locationAlwaysAndWhenInUsePermission: 'Pendant une course acceptée, Naya partage votre position avec la passagère, même écran verrouillé. Le partage s’arrête à la fin de la course.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
  ],
};

export default config;
