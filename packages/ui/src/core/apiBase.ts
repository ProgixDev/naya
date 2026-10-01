import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO !== '0';
export const STANDALONE_DEMO = Platform.OS !== 'web' && DEMO_MODE && process.env.EXPO_PUBLIC_STANDALONE !== '0';

/**
 * Native demo requests stay in-process. For connected builds, EXPO_PUBLIC_API_URL wins.
 * Otherwise, in development, reuse the
 * Metro host so a physical device on the same network reaches the laptop; the Android
 * emulator maps the host loopback to 10.0.2.2.
 */
export function resolveApiBase(): string {
  if (STANDALONE_DEMO) return 'https://demo.naya.local'; // An in-process address; never fetched over the network.
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:4010`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4010';
  return 'http://localhost:4010';
}
