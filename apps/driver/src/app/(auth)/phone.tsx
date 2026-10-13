import { router, useLocalSearchParams } from 'expo-router';
import { PhoneSignInScreen, Text } from '@naya/ui';

export default function Phone() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  return (
    <PhoneSignInScreen
      role="driver"
      initialPhone={phone}
      title="Votre numéro"
      subtitle="Il sert à vous connecter à votre espace chauffeuse."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      onCodeSent={(p, demoCode) => router.push({ pathname: '/(auth)/otp', params: { phone: p, demoCode: demoCode ?? '' } })}
      legal={
        <Text variant="micro" tone="muted" align="center">
          En continuant, vous acceptez les conditions chauffeuse et la politique de confidentialité de Naya.
        </Text>
      }
    />
  );
}
