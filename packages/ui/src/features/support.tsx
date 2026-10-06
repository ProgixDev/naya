import { Attachment } from './Attachment';
import { useTheme } from './../core/theme';
import { useState } from 'react';
import { ActivityIndicator, Platform, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, MessageCircle, Paperclip, X } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatShort, SUPPORT_STATUS_LABELS, supportTicketSchema, type SupportTicket } from '@naya/domain';
import { colors, radius } from '@naya/tokens';
import { Screen } from '../Screen';
import { PressableScale } from '../PressableScale';
import { GlossLayers, glossShadow } from '../Material';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button, IconButton } from '../Button';
import { FormField, Pill } from '../Form';
import { EmptyState, ErrorState, SkeletonList, StatusBanner, StatusPill, type BannerTone } from '../Feedback';
import { ListGroup, ListRow } from '../List';
import { toast } from '../Toast';
import { haptic } from '../haptics';
import { pickFile, uploadFile } from './uploads';

const statusTone = (t: SupportTicket['status']): BannerTone => (t === 'rejected' ? 'danger' : t === 'resolved' ? 'success' : t === 'awaiting_user' ? 'warning' : 'info');

export function TicketStatus({ ticket }: { ticket: SupportTicket }) {
  useTheme();
  return <StatusPill tone={statusTone(ticket.status)} label={SUPPORT_STATUS_LABELS[ticket.status]} />;
}

/** P16 / D18 list. */
export function TicketListScreen({ accountId, onBack, onOpen, onCreate, emptyImage }: { accountId: string; onBack: () => void; onOpen: (id: string) => void; onCreate: () => void; emptyImage?: number }) {
  useTheme();
  const api = useApi();
  const q = useQuery({ queryKey: qk.tickets(accountId), queryFn: api.support.list });
  return (
    <Screen header={<Header title="Mes demandes" onBack={onBack} />} footer={<Button label="Nouvelle demande" full onPress={onCreate} testID="new-ticket" />}>
      <View style={{ marginTop: 4 }}>
        {q.isLoading ? <SkeletonList rows={3} /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {q.data && q.data.length === 0 ? <EmptyState title="Aucune demande" message="Vos échanges avec l’équipe Naya apparaîtront ici." image={emptyImage} /> : null}
        {q.data && q.data.length > 0 ? (
          <ListGroup>
            {q.data.map((t) => (
              <ListRow key={t.id} testID={`ticket-${t.id}`} title={t.subject} subtitle={`${t.id}${t.rideId ? ` · ${t.rideId}` : ''} · ${formatShort(t.updatedAt)}`} trailing={<TicketStatus ticket={t} />} onPress={() => onOpen(t.id)} />
            ))}
          </ListGroup>
        ) : null}
      </View>
    </Screen>
  );
}

const CATEGORIES: { value: SupportTicket['category']; label: string }[] = [
  { value: 'ride', label: 'Course' },
  { value: 'payment', label: 'Paiement' },
  { value: 'safety', label: 'Sécurité' },
  { value: 'wallet', label: 'Portefeuille' },
  { value: 'account', label: 'Compte' },
  { value: 'other', label: 'Autre' },
];

/** P16 creation / D18-form: category, subject, description, up to 3 photo attachments. */
export function TicketCreateScreen({ accountId, rideId, defaultCategory = 'ride', role, onBack, onCreated }: { accountId: string; rideId: string | null; defaultCategory?: SupportTicket['category']; role: 'passenger' | 'driver'; onBack: () => void; onCreated: (id: string) => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const [category, setCategory] = useState(defaultCategory);
  const [reasonId, setReasonId] = useState<string | undefined>();
  const catalog = useQuery({ queryKey: ['naya', accountId, 'catalog'], queryFn: api.prototype.catalog });
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<{ id: string; uri: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const create = useMutation({
    mutationFn: () => api.support.create({ rideId, category, reasonId, subject, body, attachments: attachments.map((a) => a.id) }),
    onSuccess: (t) => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.tickets(accountId) });
      toast('Demande envoyée');
      onCreated(t.id);
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const submit = () => {
    const parsed = supportTicketSchema.safeParse({ rideId, category, reasonId, subject, body, attachments: attachments.map((a) => a.id) });
    if (!parsed.success) {
      const f: Record<string, string> = {};
      for (const i of parsed.error.issues) f[String(i.path[0])] = i.message;
      setErrors(f);
      haptic.warning();
      return;
    }
    if (catalog.data?.reasons.find(r=>r.id===reasonId)?.evidenceRequired && !attachments.length) { setErrors({ attachments: 'Une photo ou un PDF est requis pour ce motif.' }); return; }
    setErrors({});
    create.mutate();
  };
  const attach = async (kind: 'library'|'document' = 'library') => {
    const file = await pickFile(kind);
    if (file === 'denied') return toast('Autorisez l’accès aux photos dans les réglages pour joindre une image.', 'danger');
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(api, file, 'support_attachment');
      setAttachments((a) => [...a, { id: up.id, uri: file.uri }]);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setUploading(false);
    }
  };
  return (
    <Screen keyboard header={<Header title="Nouvelle demande" subtitle={rideId ? `À propos de la course ${rideId}` : undefined} onBack={onBack} />} footer={<Button label="Envoyer la demande" size="major" full loading={create.isPending} onPress={submit} testID="submit-ticket" />}>
      <View style={{ gap: 14, marginTop: 4 }}>
        <View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Sujet">
            {CATEGORIES.map((c) => (
              <Pill key={c.value} label={c.label} selected={category === c.value} onPress={() => { setCategory(c.value); setReasonId(undefined); }} testID={`category-${c.value}`} />
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          {catalog.data?.reasons.filter(r=>r.enabled && r.category===category).map(r=><Pill key={r.id} label={`${r.label}${r.evidenceRequired ? ' · preuve requise' : ''}`} selected={r.id===reasonId} onPress={()=>setReasonId(r.id)} />)}
        </View>
        <FormField label="Objet" value={subject} onChangeText={setSubject} error={errors.subject} placeholder="Ex. : montant de la course" testID="ticket-subject" maxLength={120} />
        <FormField label="Votre message" value={body} onChangeText={setBody} error={errors.body} multiline numberOfLines={5} textAlignVertical="top" placeholder="Décrivez ce qui s’est passé." testID="ticket-body" maxLength={2000} inputStyle={{ minHeight: 96 }} />
        <View style={{ gap: 8 }}>
          {attachments.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {attachments.map((a) => (
              <View key={a.id}>
                <Image source={{ uri: a.uri }} style={{ width: 72, height: 72, borderRadius: radius.row }} contentFit="cover" accessibilityLabel="Pièce jointe" />
                <View style={{ position: 'absolute', top: -8, right: -8 }}>
                  <IconButton variant="solid" size={28} icon={<X size={14} color={colors.ink} />} accessibilityLabel="Retirer la pièce jointe" onPress={() => setAttachments((l) => l.filter((x) => x.id !== a.id))} />
                </View>
              </View>
            ))}
          </View> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {attachments.length < 3 ? <Button label="Photo" variant="secondary" size="compact" icon={<Paperclip size={16} color={colors.accent} />} loading={uploading} onPress={() => attach()} testID="attach" /> : null}
            {attachments.length < 3 ? <Button label="PDF" variant="secondary" size="compact" loading={uploading} onPress={() => attach('document')} /> : null}
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              Pièces jointes privées, vues par l’équipe support seulement.
            </Text>
          </View>
        </View>
        {errors.attachments ? <Text tone="danger">{errors.attachments}</Text> : null}
        {category === 'safety' ? <StatusBanner compact tone="danger" title="Urgence : 19 (police) · 15 (SAMU)" message="signalements traités en priorité" /> : null}
      </View>
    </Screen>
  );
}

/** P16-status / P16-reply / D18-status / D18-reply: thread with status and composer. */
export function TicketThreadScreen({ accountId, ticketId, onBack }: { accountId: string; ticketId: string; onBack: () => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.ticket(accountId, ticketId), queryFn: () => api.support.get(ticketId), refetchInterval: 8000 });
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: () => api.support.message(ticketId, { body: text, attachments: [] }),
    onSuccess: (t) => {
      setText('');
      qc.setQueryData(qk.ticket(accountId, ticketId), t);
      qc.invalidateQueries({ queryKey: qk.tickets(accountId) });
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const t = q.data;
  return (
    <Screen
      keyboard
      header={<Header title={t?.subject ?? 'Demande'} subtitle={t ? `${t.id}${t.rideId ? ` · course ${t.rideId}` : ''}` : undefined} onBack={onBack} />}
      footer={
        t && t.status !== 'resolved' && t.status !== 'rejected' ? (
          <Composer value={text} onChange={setText} sending={send.isPending} onSend={() => send.mutate()} />
        ) : undefined
      }
    >
      {q.isLoading ? <SkeletonList rows={3} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {t ? (
        <View style={{ gap: 12, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TicketStatus ticket={t} />
            <Text variant="caption" tone="muted">
              Mise à jour {formatShort(t.updatedAt)}
            </Text>
          </View>
          {t.status === 'awaiting_user' ? <StatusBanner compact tone="warning" title="L’équipe attend votre réponse" message="répondez ci-dessous" /> : null}
          {t.resolution ? <StatusBanner tone={t.status === 'rejected' ? 'danger' : 'success'} title={`${t.status === 'rejected' ? 'Rejetée' : 'Résolue'} · ${t.resolution.outcome}`} message={t.resolution.note} /> : null}
          <View style={{ gap: 10, marginTop: 4 }} accessibilityLabel="Échanges">
              {t.messages.map((m) => {
                const mine = m.author === 'user';
                return (
                  <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', backgroundColor: mine ? colors.selected : m.author === 'system' ? 'transparent' : colors.surface, borderRadius: 18, padding: m.author === 'system' ? 0 : 12, borderWidth: m.author === 'agent' ? 1 : 0, borderColor: colors.line }}>
                    {m.author !== 'user' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <MessageCircle size={14} color={colors.accent} />
                        <Text variant="micro" tone="accent" weight="semibold">
                          {m.authorName}
                        </Text>
                      </View>
                    ) : null}
                    <Text variant="label" tone={m.author === 'system' ? 'muted' : 'ink'}>
                      {m.body}
                    </Text>
                    {m.attachments.length ? (
                      <View style={{gap:8,marginTop:8}}>{m.attachments.map(id=><Attachment key={id} id={id} accountId={accountId} />)}</View>
                    ) : null}
                    <Text variant="micro" tone="muted" style={{ marginTop: 4 }} numeric>
                      {formatShort(m.at)}
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

/** Pill composer: the field and a round glossy send button share one capsule. */
function Composer({ value, onChange, sending, onSend }: { value: string; onChange: (v: string) => void; sending: boolean; onSend: () => void }) {
  useTheme();
  const ready = !!value.trim() && !sending;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 52, borderRadius: 26, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Votre réponse"
        placeholderTextColor={colors.disabledText}
        multiline
        maxLength={2000}
        accessibilityLabel="Répondre"
        testID="reply-input"
        style={[{ flex: 1, minHeight: 40, maxHeight: 120, paddingTop: 10, paddingBottom: 10, fontFamily: 'Inter_500Medium', fontSize: 16, color: colors.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
      />
      <PressableScale onPress={onSend} disabled={!ready} accessibilityRole="button" accessibilityLabel="Envoyer" accessibilityState={{ disabled: !ready, busy: sending }} testID="send-reply" style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ready ? undefined : colors.selected }, ready ? glossShadow('accent') : null]}>
        {ready ? <GlossLayers tone="accent" radius={20} /> : null}
        <View>{sending ? <ActivityIndicator color={colors.accent} /> : <ArrowUp size={20} color={ready ? colors.inverse : colors.disabledText} />}</View>
      </PressableScale>
    </View>
  );
}
