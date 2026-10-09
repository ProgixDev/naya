import { Attachment } from './Attachment';
import { useTheme } from './../core/theme';
import { useState } from 'react';
import { ActivityIndicator, Platform, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Camera, FileText, MessageCircle, Paperclip, X } from 'lucide-react-native';
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

const MAX_ATTACHMENTS = 5;
/** General questions that are not disputes about a ride. */
const GENERAL: { id: string; label: string; category: SupportTicket['category'] }[] = [
  { id: 'general-account', label: 'Question sur mon compte', category: 'account' },
];

type Picked = { id: string; uri: string; pdf: boolean };

/** P16 creation / D18-form: reason, concerned ride, what happened, photos, screenshots and documents. */
export function TicketCreateScreen({ accountId, rideId, defaultCategory = 'ride', role, onBack, onCreated }: { accountId: string; rideId: string | null; defaultCategory?: SupportTicket['category']; role: 'passenger' | 'driver'; onBack: () => void; onCreated: (id: string) => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['naya', accountId, 'catalog'], queryFn: api.prototype.catalog });
  const rides = useQuery({ queryKey: ['naya', accountId, 'support-rides'], queryFn: () => api.rides.history(0, 5), enabled: !rideId && defaultCategory !== 'account' });
  const reasons = (catalog.data?.reasons ?? []).filter((r) => r.enabled && (!r.roles?.length || r.roles.includes(role)));
  const [choice, setChoice] = useState<string | undefined>(defaultCategory === 'account' ? 'general-account' : undefined);
  const [ride, setRide] = useState<string | null>(rideId);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Picked[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const reason = reasons.find((r) => r.id === choice);
  const general = GENERAL.find((g) => g.id === choice);
  const label = reason?.label ?? general?.label ?? '';
  const input = () => ({
    rideId: ride,
    category: reason?.category ?? general?.category ?? defaultCategory,
    reasonId: reason?.id,
    subject: `${label}${ride ? ` · ${ride}` : ''}`.slice(0, 120),
    body,
    attachments: attachments.map((a) => a.id),
  });
  const create = useMutation({
    mutationFn: () => api.support.create(input()),
    onSuccess: (t) => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.tickets(accountId) });
      toast('Demande envoyée');
      onCreated(t.id);
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const submit = () => {
    if (!label) {
      setErrors({ reason: 'Choisissez le motif.' });
      haptic.warning();
      return;
    }
    const parsed = supportTicketSchema.safeParse(input());
    if (!parsed.success) {
      const f: Record<string, string> = {};
      for (const i of parsed.error.issues) f[String(i.path[0])] = i.message;
      setErrors(f);
      haptic.warning();
      return;
    }
    if (reason?.evidenceRequired && !attachments.length) {
      setErrors({ attachments: 'Une photo ou un document est obligatoire pour ce motif.' });
      haptic.warning();
      return;
    }
    setErrors({});
    create.mutate();
  };
  const attach = async (kind: 'camera' | 'library' | 'document') => {
    const file = await pickFile(kind);
    if (file === 'denied') return toast(kind === 'camera' ? 'Autorisez l’appareil photo dans les réglages.' : 'Autorisez l’accès aux photos dans les réglages pour joindre une image.', 'danger');
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(api, file, 'support_attachment');
      setAttachments((a) => [...a, { id: up.id, uri: file.uri, pdf: file.mimeType === 'application/pdf' }]);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setUploading(false);
    }
  };
  return (
    <Screen keyboard header={<Header title={rideId || ride ? 'Signaler un problème' : 'Nouvelle demande'} subtitle={ride ? `À propos de la course ${ride}` : undefined} onBack={onBack} />} footer={<Button label="Envoyer" size="major" full loading={create.isPending} onPress={submit} testID="submit-ticket" />}>
      <View style={{ gap: 16, marginTop: 4 }}>
        <View style={{ gap: 8 }}>
          <Text variant="label">Motif</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Motif">
            {[...reasons, ...GENERAL].map((r) => (
              <Pill key={r.id} label={r.label} selected={choice === r.id} onPress={() => { setChoice(r.id); setErrors({}); }} testID={`reason-${r.id}`} />
            ))}
          </View>
          {errors.reason ? <Text tone="danger">{errors.reason}</Text> : null}
          {reason?.evidenceRequired ? <StatusBanner compact tone="warning" title="Photo obligatoire" message="joignez une photo ou un document pour ce motif" /> : null}
          {reason?.category === 'safety' ? <StatusBanner compact tone="danger" title="Urgence : 19 (police) · 15 (SAMU)" message="signalements de sécurité traités en priorité" /> : null}
        </View>
        {!rideId && rides.data?.items.length ? (
          <View style={{ gap: 8 }}>
            <Text variant="label">Course concernée</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {rides.data.items.map((r) => (
                <Pill key={r.id} label={`${formatShort(r.completedAt ?? r.requestedAt)} · ${r.route.stops[r.route.stops.length - 1]!.label}`} selected={ride === r.id} onPress={() => setRide(r.id)} testID={`ride-${r.id}`} />
              ))}
              <Pill label="Aucune course" selected={!ride} onPress={() => setRide(null)} />
            </View>
          </View>
        ) : null}
        <FormField label="Décrivez ce qui s’est passé" value={body} onChangeText={setBody} error={errors.body} multiline numberOfLines={6} textAlignVertical="top" placeholder="Quand, où, ce que vous avez constaté, ce que vous attendez de Naya…" testID="ticket-body" maxLength={2000} inputStyle={{ minHeight: 120 }} />
        <View style={{ gap: 8 }}>
          <Text variant="label">Preuves ({attachments.length}/{MAX_ATTACHMENTS})</Text>
          {attachments.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {attachments.map((a) => (
                <View key={a.id}>
                  {a.pdf ? (
                    <View style={{ width: 72, height: 72, borderRadius: radius.row, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
                      <FileText size={24} color={colors.accent} />
                      <Text variant="micro">PDF</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: a.uri }} style={{ width: 72, height: 72, borderRadius: radius.row }} contentFit="cover" accessibilityLabel="Pièce jointe" />
                  )}
                  <View style={{ position: 'absolute', top: -8, right: -8 }}>
                    <IconButton variant="solid" size={28} icon={<X size={14} color={colors.ink} />} accessibilityLabel="Retirer la pièce jointe" onPress={() => setAttachments((l) => l.filter((x) => x.id !== a.id))} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {attachments.length < MAX_ATTACHMENTS ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label="Prendre une photo" variant="secondary" size="compact" icon={<Camera size={16} color={colors.accent} />} loading={uploading} onPress={() => attach('camera')} testID="attach-camera" />
              <Button label="Photo ou capture" variant="secondary" size="compact" icon={<Paperclip size={16} color={colors.accent} />} loading={uploading} onPress={() => attach('library')} testID="attach" />
              <Button label="Document (PDF)" variant="secondary" size="compact" icon={<FileText size={16} color={colors.accent} />} loading={uploading} onPress={() => attach('document')} testID="attach-document" />
            </View>
          ) : null}
          <Text variant="caption" tone="muted">
            Photos, captures d’écran, reçus ou documents. Privés, vus par l’équipe Naya seulement.
          </Text>
          {errors.attachments ? <Text tone="danger">{errors.attachments}</Text> : null}
        </View>
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
  const [files, setFiles] = useState<Picked[]>([]);
  const [uploading, setUploading] = useState(false);
  const send = useMutation({
    mutationFn: () => api.support.message(ticketId, { body: text.trim() || 'Pièce(s) jointe(s) ajoutée(s).', attachments: files.map((f) => f.id) }),
    onSuccess: (t) => {
      setText('');
      setFiles([]);
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
          <View style={{ gap: 8 }}>
            {files.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {files.map((f) => <Pill key={f.id} label={f.pdf ? 'PDF ✕' : 'Photo ✕'} onPress={() => setFiles((l) => l.filter((x) => x.id !== f.id))} />)}
              </View>
            ) : null}
            <Composer
              value={text}
              onChange={setText}
              sending={send.isPending}
              canSend={files.length > 0}
              onSend={() => send.mutate()}
              onAttach={files.length < MAX_ATTACHMENTS && !uploading ? async () => {
                const file = await pickFile('library');
                if (file === 'denied') return toast('Autorisez l’accès aux photos dans les réglages.', 'danger');
                if (!file) return;
                setUploading(true);
                try {
                  const up = await uploadFile(api, file, 'support_attachment');
                  setFiles((l) => [...l, { id: up.id, uri: file.uri, pdf: file.mimeType === 'application/pdf' }]);
                } catch (e) {
                  toast(errorMessage(e), 'danger');
                } finally {
                  setUploading(false);
                }
              } : undefined}
            />
          </View>
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
          {t.status === 'awaiting_user' ? <StatusBanner compact tone="warning" title="Informations demandées" message="répondez ci-dessous, vous pouvez joindre des photos" /> : null}
          {t.resolution ? <StatusBanner tone={t.status === 'rejected' ? 'danger' : 'success'} title={`${t.status === 'rejected' ? 'Rejetée' : 'Résolue'} · ${t.resolution.outcome}`} message={t.resolution.note} /> : null}
          {t.history?.length ? (
            <View style={{ gap: 4 }} accessibilityLabel="Suivi du dossier">
              <Text variant="label">Suivi</Text>
              {t.history.filter((h) => h.kind === 'opened' || h.kind === 'status' || h.kind === 'decision').map((h, i) => (
                <Text key={i} variant="caption" tone="muted" numeric>{formatShort(h.at)} · {h.label}</Text>
              ))}
            </View>
          ) : null}
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
function Composer({ value, onChange, sending, onSend, onAttach, canSend }: { value: string; onChange: (v: string) => void; sending: boolean; onSend: () => void; onAttach?: () => void; canSend?: boolean }) {
  useTheme();
  const ready = (!!value.trim() || !!canSend) && !sending;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 52, borderRadius: 26, paddingLeft: onAttach ? 6 : 18, paddingRight: 6, paddingVertical: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      {onAttach ? <IconButton size={40} icon={<Paperclip size={18} color={colors.accent} />} accessibilityLabel="Joindre une photo ou une capture" onPress={onAttach} testID="reply-attach" /> : null}
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
