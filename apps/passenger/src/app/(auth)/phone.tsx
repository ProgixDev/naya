import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { PhoneSignInScreen, Text, useAuthProviders } from '@naya/ui';

/**
 * Apple sign-in is shown only when the backend reports it configured AND the device
 * supports it, using Apple's native button. Google stays hidden until configured.
 */
function ProviderButtons() {
  const providers = useAuthProviders();
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);
  if (!(providers.data?.apple && appleAvailable)) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text variant="caption" tone="muted" align="center">
        ou
      </Text>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={999}
        style={{ height: 50, width: '100%' }}
        onPress={async () => {
          await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME] });
          // The identity token must be verified server-side; see docs/INTEGRATIONS.md.
        }}
      />
    </View>
  );
}

export default function Phone() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  return (
    <PhoneSignInScreen
      role="passenger"
      initialPhone={phone}
      title="Votre numéro"
      subtitle="Il sert à vous connecter et à joindre votre chauffeuse de façon masquée."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      onCodeSent={(p, demoCode) => router.push({ pathname: '/(auth)/otp', params: { phone: p, demoCode: demoCode ?? '' } })}
      providers={<ProviderButtons />}
      legal={
        <Text variant="micro" tone="muted" align="center">
          En continuant, vous acceptez les conditions d’utilisation et la politique de confidentialité de Naya.
        </Text>
      }
    />
  );
}
