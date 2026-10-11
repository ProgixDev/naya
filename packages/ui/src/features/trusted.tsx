import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react-native';
import { errorMessage } from '@naya/api';
import { useApi } from '@naya/api/react';
import type { TrustedContact } from '@naya/domain';
import { colors } from '@naya/tokens';
import { useTheme } from '../core/theme';
import { Screen } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button } from '../Button';
import { FormField } from '../Form';
import { PressableScale } from '../PressableScale';
import { toast } from '../Toast';
import { haptic } from '../haptics';

const card = () => ({ backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 12, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 }) as const;
const MAX = 3;

/** Up to 3 people the SOS sheet offers to alert by SMS with the position. */
export function TrustedContactsScreen({ onBack }: { onBack: () => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['naya', 'sos', 'me'], queryFn: api.me.get });
  const [list, setList] = useState<TrustedContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (me.data) setList(me.data.user.trustedContacts ?? []); }, [me.data]);
  const save = async (next: TrustedContact[]) => {
    setSaving(true);
    try {
      await api.me.update({ trustedContacts: next });
      setList(next);
      await qc.invalidateQueries({ queryKey: ['naya'] });
      return true;
    } catch (e) {
      toast(errorMessage(e), 'danger');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const add = async () => {
    if (await save([...list, { name: name.trim(), phone: phone.trim() }])) {
      setName('');
      setPhone('');
      toast('Contact ajouté', 'success');
    }
  };
  return (
    <Screen keyboard header={<Header title="Contacts SOS" onBack={onBack} />} testID="trusted-contacts">
      <View style={{ gap: 20, marginTop: 4 }}>
        <View style={[card(), { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.mauveSoft }]}>
          <ShieldCheck size={22} color={colors.accent} strokeWidth={2} />
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>En cas d’alerte SOS, vous pourrez prévenir ces personnes par SMS avec votre position, en un geste.</Text>
        </View>

        <View style={{ gap: 10 }}>
          {list.map((c, i) => (
            <View key={`${c.phone}-${i}`} style={[card(), { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
                <Text weight="bold" tone="accent" style={{ fontSize: 16 }}>{c.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{c.name}</Text>
                <Text tone="muted" numeric style={{ fontSize: 13, lineHeight: 18 }}>{c.phone}</Text>
              </View>
              <PressableScale onPress={() => { haptic.select(); save(list.filter((_, j) => j !== i)); }} accessibilityRole="button" accessibilityLabel={`Retirer ${c.name}`} hitSlop={8} testID={`trusted-remove-${i}`} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={18} color={colors.danger} />
              </PressableScale>
            </View>
          ))}
          {!list.length && me.data ? <Text tone="muted" align="center" style={{ fontSize: 14, paddingVertical: 8 }}>Aucun contact pour l’instant.</Text> : null}
        </View>

        {list.length < MAX ? (
          <View style={[card(), { gap: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Plus size={18} color={colors.accent} strokeWidth={2.2} />
              <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>Ajouter un contact</Text>
              <Text tone="muted" numeric style={{ marginLeft: 'auto', fontSize: 12 }}>{list.length}/{MAX}</Text>
            </View>
            <FormField label="Nom" value={name} onChangeText={setName} autoCapitalize="words" testID="trusted-name" />
            <FormField label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+212 6 12 34 56 78" testID="trusted-phone" />
            <Button label="Ajouter" loading={saving} disabled={!name.trim() || phone.replace(/\D/g, '').length < 6} onPress={add} testID="trusted-add" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
