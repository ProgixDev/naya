import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { logoConcepts, conceptSvg } from '@naya/assets';
import { colors, darkColors, lightColors } from '@naya/tokens';
import { useTheme } from '../core/theme';
import { Screen } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
export function BrandConceptsScreen({ onBack }: { onBack: () => void }) {
  const scheme = useTheme();
  // The preview tile shows the symbol in the other scheme. A fixed dark tile matched the dark
  // card exactly (#231D28 on #231D28) and vanished; in dark mode the card already is the dark
  // preview, so the tile shows the light one instead.
  const preview = scheme === 'dark' ? lightColors : darkColors;
  return (
    <Screen header={<Header title="Six pistes pour Naya" onBack={onBack} />}>
      <View style={{ gap: 18 }}>
        <Text tone="muted">
          Croquis vectoriels originaux · symbole, signature et aperçu sur fond
          {scheme === 'dark' ? ' clair' : ' sombre'}.
        </Text>
        {logoConcepts.map((c) => (
          <View
            key={c.id}
            style={{
              backgroundColor: colors.surface,
              padding: 20,
              borderRadius: 24,
              gap: 12,
            }}
          >
            <Text variant="title">{c.name}</Text>
            <Text variant="caption" tone="muted">
              {c.description}
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
            >
              <SvgXml
                xml={conceptSvg(c.id, colors.accent, false, colors.surface)}
                width={70}
                height={70}
              />
              <SvgXml
                xml={conceptSvg(c.id, colors.ink, true, colors.surface)}
                width={182}
                height={70}
              />
            </View>
            <View
              testID={`logo-preview-${c.id}`}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: preview.surface,
                padding: 10,
                borderRadius: 18,
              }}
            >
              <SvgXml
                xml={conceptSvg(c.id, preview.accent, false, preview.surface)}
                width={52}
                height={52}
              />
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
