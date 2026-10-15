import { router, useLocalSearchParams } from 'expo-router';
import { LegalConsent, PhoneSignInScreen } from '@naya/ui';

export default function Phone() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  return (
    <PhoneSignInScreen
      role="driver"
      initialPhone={phone}
      title="Votre numéro"
      subtitle="Il sert à vous connecter à votre espace chauffeuse."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      onCodeSent={(p) => router.push({ pathname: '/(auth)/otp', params: { phone: p } })}
      // PAX-18: no terms or privacy page exists yet; pass `onOpen` to LegalConsent once one does.
      legal={<LegalConsent terms="conditions chauffeuse" />}
    />
  );
}
