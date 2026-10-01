import { type ReactNode } from 'react';
import { View } from 'react-native';
import { colors } from '@naya/tokens';
import { Avatar } from './Brand';
import { Text } from './Text';

export function ProfileHero({ name, detail, source, status }: { name: string; detail: string; source?: number | null; status?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 24, gap: 12 }}>
      <View style={{ padding: 5, borderRadius: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <Avatar name={name} source={source} size={80} />
      </View>
      <View style={{ gap: 5, alignItems: 'center' }}>
        <Text variant="title" weight="semibold" align="center">{name}</Text>
        <Text variant="caption" tone="muted" align="center">{detail}</Text>
      </View>
      {status ? <View style={{ alignItems: 'center' }}>{status}</View> : null}
    </View>
  );
}
