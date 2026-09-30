import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Paperclip, X } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatShort, SUPPORT_STATUS_LABELS, supportTicketSchema, type SupportTicket } from '@naya/domain';
import { colors, radius } from '@naya/tokens';
import { Screen, Section } from '../Screen';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button, IconButton } from '../Button';
import { FormField, Pill } from '../Form';
import { EmptyState, ErrorState, SkeletonList, StatusBanner, StatusPill, type BannerTone } from '../Feedback';
import { ListGroup, ListRow } from '../List';
import { toast } from '../Toast';
import { haptic } from '../haptics';
import { pickFile, uploadFile } from './uploads';

const statusTone = (t: SupportTicket['status']): BannerTone => (t === 'resolved' ? 'success' : t === 'awaiting_user' ? 'warning' : 'info');

export function TicketStatus({ ticket }: { ticket: SupportTicket }) {
  return <StatusPill tone={statusTone(ticket.status)} label={SUPPORT_STATUS_LABELS[ticket.status]} />;
}

/** P16 / D18 list. */
export function TicketListScreen({ accountId, onBack, onOpen, onCreate, emptyImage }: { accountId: string; onBack: () => void; onOpen: (id: string) => void; onCreate: () => void; emptyImage?: number }) {
  const api = useApi();
  const q = useQuery({ queryKey: qk.tickets(accountId), queryFn: api.support.list });
  return (
    <Screen header={<Header title="Mes demandes" onBack={onBack} />} footer={<Button label="Nouvelle demande" full onPress={onCreate} testID="new-ticket" />}>
      <View style={{ marginTop: 12 }}>
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
  const api = useApi();
  const qc = useQueryClient();
  const [category, setCategory] = useState(defaultCategory);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<{ id: string; uri: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const create = useMutation({
    mutationFn: () => api.support.create({ rideId, category, subject, body, attachments: attachments.map((a) => a.id) }),
    onSuccess: (t) => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.tickets(accountId) });
      toast('Demande envoyée');
      onCreated(t.id);
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const submit = () => {
    const parsed = supportTicketSchema.safeParse({ rideId, category, subject, body, attachments: attachments.map((a) => a.id) });
    if (!parsed.success) {
      const f: Record<string, string> = {};
      for (const i of parsed.error.issues) f[String(i.path[0])] = i.message;
      setErrors(f);
      haptic.warning();
      return;
    }
    setErrors({});
    create.mutate();
  };
  const attach = async () => {
    const file = await pickFile('library');
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
      <View style={{ gap: 20, marginTop: 12 }}>
        <View style={{ gap: 8 }}>
          <Text variant="caption" weight="semibold">
            Sujet
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {CATEGORIES.filter((c) => role === 'driver' || c.value !== 'wallet').map((c) => (
              <Pill key={c.value} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} testID={`category-${c.value}`} />
            ))}
          </View>
        </View>
        <FormField label="Objet" value={subject} onChangeText={setSubject} error={errors.subject} placeholder="Ex. : montant de la course" testID="ticket-subject" maxLength={120} />
        <FormField label="Votre message" value={body} onChangeText={setBody} error={errors.body} multiline numberOfLines={5} textAlignVertical="top" placeholder="Décrivez ce qui s’est passé." testID="ticket-body" maxLength={2000} inputStyle={{ minHeight: 120 }} />
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {attachments.map((a) => (
              <View key={a.id}>
                <Image source={{ uri: a.uri }} style={{ width: 72, height: 72, borderRadius: radius.row }} contentFit="cover" accessibilityLabel="Pièce jointe" />
                <View style={{ position: 'absolute', top: -8, right: -8 }}>
                  <IconButton variant="solid" size={28} icon={<X size={14} color={colors.ink} />} accessibilityLabel="Retirer la pièce jointe" onPress={() => setAttachments((l) => l.filter((x) => x.id !== a.id))} />
                </View>
              </View>
            ))}
          </View>
          {attachments.length < 3 ? <Button label="Joindre une photo" variant="secondary" size="compact" icon={<Paperclip size={16} color={colors.accent} />} loading={uploading} onPress={attach} testID="attach" /> : null}
          <Text variant="caption" tone="muted">
            Les pièces jointes sont privées : seule l’équipe support peut les consulter.
          </Text>
        </View>
        {category === 'safety' ? <StatusBanner tone="danger" title="En cas d’urgence, appelez le 19 (police) ou le 15 (SAMU)." message="L’équipe Naya traite les signalements de sécurité en priorité." /> : null}
      </View>
    </Screen>
  );
}

/** P16-status / P16-reply / D18-status / D18-reply: thread with status and composer. */
export function TicketThreadScreen({ accountId, ticketId, onBack }: { accountId: string; ticketId: string; onBack: () => void }) {
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
        t && t.status !== 'resolved' ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <FormField label="Répondre" value={text} onChangeText={setText} placeholder="Votre message" multiline testID="reply-input" maxLength={2000} />
            </View>
            <Button label="Envoyer" disabled={!text.trim()} loading={send.isPending} onPress={() => send.mutate()} testID="send-reply" />
          </View>
        ) : undefined
      }
    >
      {q.isLoading ? <SkeletonList rows={3} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {t ? (
        <View style={{ gap: 16, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TicketStatus ticket={t} />
            <Text variant="caption" tone="muted">
              Mise à jour {formatShort(t.updatedAt)}
            </Text>
          </View>
          {t.status === 'awaiting_user' ? <StatusBanner tone="warning" title="L’équipe attend votre réponse" message="Répondez ci-dessous pour poursuivre l’échange." /> : null}
          {t.resolution ? <StatusBanner tone="success" title={`Résolue · ${t.resolution.outcome}`} message={t.resolution.note} /> : null}
          <Section title="Échanges" style={{ marginTop: 8 }}>
            <View style={{ gap: 10 }}>
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
                      <Text variant="micro" tone="muted" style={{ marginTop: 4 }}>
                        {m.attachments.length} pièce(s) jointe(s)
                      </Text>
                    ) : null}
                    <Text variant="micro" tone="muted" style={{ marginTop: 4 }} numeric>
                      {formatShort(m.at)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Section>
        </View>
      ) : null}
    </Screen>
  );
}
