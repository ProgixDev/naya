import { createElement, useState } from 'react';
import { Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { useTheme } from '../core/theme';
import { Button } from '../Button';
import { Sheet } from '../BottomSheet';
import { Text } from '../Text';
import { ErrorState } from '../Feedback';
export function Attachment({
  id,
  accountId,
  label = 'Pièce jointe',
}: {
  id: string;
  accountId: string;
  label?: string;
}) {
  useTheme();
  const api = useApi();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['naya', accountId, 'attachment', id],
    queryFn: () => api.uploadPreview(id),
  });
  const pdf = q.data?.mimeType === 'application/pdf';
  const video = !!q.data?.mimeType.startsWith('video/');
  return (
    <View style={{ gap: 8 }}>
      {video ? (
        <View style={{ width: 120, height: 90, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 4 }} accessibilityLabel={`${label} · vidéo`}>
          <Text weight="semibold" tone="accent" style={{ fontSize: 13 }}>▶ Vidéo</Text>
          <Text tone="muted" style={{ fontSize: 11 }}>Visible par l’équipe Naya</Text>
        </View>
      ) : null}
      {q.data && !pdf && !video ? (
        <Image
          source={{ uri: q.data.uri }}
          style={{
            width: 120,
            height: 90,
            borderRadius: 12,
            backgroundColor: colors.background,
          }}
          contentFit="contain"
          accessibilityLabel={label}
        />
      ) : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {video ? null : <Button
        label={pdf ? 'Document PDF' : label}
        variant="secondary"
        size="compact"
        onPress={() => setOpen(true)}
      />}
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
              <Text>
                Document PDF joint à la demande. Disponible pour examen dans le
                back-office.
              </Text>
            )
          ) : (
            <Image
              source={{ uri: q.data.uri }}
              style={{ width: '100%', height: 380 }}
              contentFit="contain"
            />
          )
        ) : null}
      </Sheet>
    </View>
  );
}
