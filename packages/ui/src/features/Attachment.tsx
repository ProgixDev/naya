import { createElement, useState } from 'react';
import { Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react-native';
import { useApi } from '@naya/api/react';
import { colors, radius } from '@naya/tokens';
import { useTheme } from '../core/theme';
import { Button } from '../Button';
import { Sheet } from '../BottomSheet';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { PressableScale } from '../PressableScale';

const THUMB = { width: 120, height: 90 } as const;

/**
 * An uploaded photo or PDF. A photo is its own button: the thumbnail opens it in a sheet (no second
 * « Pièce jointe » button under it). A PDF is a button with a `FileText` glyph (A21).
 * `caption` prints the label under the thumbnail, for lists where nothing else names the photo.
 */
export function Attachment({
  id,
  accountId,
  label = 'Pièce jointe',
  caption = true,
  testID,
}: {
  id: string;
  accountId: string;
  label?: string;
  caption?: boolean;
  testID?: string;
}) {
  useTheme();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['naya', accountId, 'attachment', id],
    queryFn: () => api.uploadPreview(id),
  });
  const pdf = q.data?.mimeType === 'application/pdf';
  return (
    <View style={{ gap: 6 }} testID={testID}>
      {q.isLoading ? (
        <View
          style={{ ...THUMB, borderRadius: radius.row, backgroundColor: colors.mauveSoft }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${label}, chargement`}
        />
      ) : null}
      {q.isError ? (
        <View style={{ gap: 4, alignItems: 'flex-start' }} accessibilityRole="alert">
          <Text variant="caption" tone="muted">
            {label} indisponible.
          </Text>
          <Button label="Réessayer" variant="ghost" size="compact" onPress={() => q.refetch()} testID={testID ? `${testID}-retry` : undefined} />
        </View>
      ) : null}
      {q.data && !pdf ? (
        <PressableScale
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Ouvre la photo en grand"
          testID={testID ? `${testID}-open` : undefined}
          style={{ alignSelf: 'flex-start' }}
        >
          <Image
            source={{ uri: q.data.uri }}
            style={{ ...THUMB, borderRadius: radius.row, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline }}
            contentFit="cover"
            accessible={false}
          />
        </PressableScale>
      ) : null}
      {q.data && pdf ? (
        <Button
          label="Document PDF"
          variant="secondary"
          size="compact"
          icon={<Icon icon={FileText} size={16} color={colors.accent} />}
          onPress={() => setOpen(true)}
          accessibilityHint={label === 'Pièce jointe' ? undefined : label}
          testID={testID ? `${testID}-open` : undefined}
        />
      ) : null}
      {caption && q.data && !pdf ? (
        <Text variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: THUMB.width }} accessible={false}>
          {label}
        </Text>
      ) : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {q.data ? (
          pdf ? (
            Platform.OS === 'web' ? (
              createElement('iframe', {
                src: q.data.uri,
                title: label,
                style: { height: 400, width: '100%', border: 0 },
              })
            ) : (
              <Text>Document PDF joint à la demande. L’équipe Naya le consulte depuis son espace.</Text>
            )
          ) : (
            <Image source={{ uri: q.data.uri }} style={{ width: '100%', height: 380 }} contentFit="contain" accessibilityLabel={label} />
          )
        ) : null}
      </Sheet>
    </View>
  );
}
