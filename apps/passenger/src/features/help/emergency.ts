import { Alert, Linking } from 'react-native';

/** The numbers live in @naya/domain so both apps' safety sheets read the same list (PAX-11). */
export { EMERGENCY_NUMBERS, EMERGENCY_NUMBERS_TEXT, MOBILE_EMERGENCY_NUMBER } from '@naya/domain';

/**
 * Opens the phone's dialler on an emergency number. Where the device cannot dial (iPad,
 * simulator, web) a native alert says so: a toast would sit behind a modal sheet (UI-07).
 */
export function dialEmergency(number: string) {
  Linking.openURL(`tel:${number}`).catch(() => Alert.alert('Appel impossible depuis cet appareil', `Composez le ${number} depuis un téléphone.`));
}
