import { useTheme } from './core/theme';
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import { colors } from '@naya/tokens';
import { Avatar } from './Brand';
import { Text } from './Text';

export interface ProfileHeroProps {
  name: string;
  detail: string;
  source?: number | null;
  /**
   * Verified account: a 16-pt `BadgeCheck` seal beside the name (A80, A121), read as « compte vérifié ».
   * It replaces the « Compte vérifié » pill passed as `status`.
   */
  verified?: boolean;
  /** Free content under the detail line. Problems only (a dossier to fix); a verified seal uses `verified`. */
  status?: ReactNode;
}

export function ProfileHero({ name, detail, source, verified, status }: ProfileHeroProps) {
  useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 24, gap: 12 }}>
      <View style={{ padding: 5, borderRadius: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <Avatar name={name} source={source} size={80} />
      </View>
      <View style={{ gap: 5, alignItems: 'center' }}>
        <View accessible accessibilityLabel={verified ? `${name}, compte vérifié` : name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
          <Text variant="title" weight="semibold" align="center" style={{ flexShrink: 1 }}>
            {name}
          </Text>
          {verified ? (
            <View testID="profile-verified">
              <BadgeCheck size={16} strokeWidth={2} color={colors.success} />
            </View>
          ) : null}
        </View>
        <Text variant="caption" tone="muted" align="center">{detail}</Text>
      </View>
      {status ? <View style={{ alignItems: 'center' }}>{status}</View> : null}
    </View>
  );
}
