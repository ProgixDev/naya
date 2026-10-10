import { useTheme, Text } from '@naya/ui';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@naya/api/react';
import { colors } from '@naya/tokens';
import { useAccountId } from '@/lib/queries';

/** Round profile photo with a white ring; falls back to the initial while loading or without a photo. */
export function ProfileAvatar({ uploadId, name, size = 92, ring = 4, busy }: { uploadId?: string | null; name: string; size?: number; ring?: number; busy?: boolean }) {
  useTheme();
  const api = useApi();
  const a = useAccountId();
  // Uploads are private: fetched with the session as a data URI (same path as attachments).
  const photo = useQuery({ queryKey: ['naya', a, 'avatar', uploadId], queryFn: () => api.uploadPreview(uploadId!), enabled: !!uploadId, staleTime: Infinity });
  const inner = size - ring * 2;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={uploadId ? `Photo de profil de ${name}` : name}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF', padding: ring, shadowColor: '#1E0A17', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
    >
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', backgroundColor: '#E9D5E1', alignItems: 'center', justifyContent: 'center' }}>
        {uploadId && photo.data ? (
          <Image source={{ uri: photo.data.uri }} style={{ width: inner, height: inner }} contentFit="cover" transition={150} />
        ) : (
          <Text weight="bold" style={{ fontSize: Math.round(inner * 0.4), lineHeight: Math.round(inner * 0.48), color: '#6B3657' }}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
        )}
        {busy ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(41,35,45,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.inverse} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
