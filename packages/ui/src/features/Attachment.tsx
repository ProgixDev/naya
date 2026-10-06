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
  return (
    <View style={{ gap: 8 }}>
      {q.data && !pdf ? (
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
      <Button
        label={pdf ? 'Document PDF' : label}
        variant="secondary"
        size="compact"
        onPress={() => setOpen(true)}
      />
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
