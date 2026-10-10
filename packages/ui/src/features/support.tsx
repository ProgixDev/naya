import { Attachment } from './Attachment';
import { useTheme } from './../core/theme';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Camera, Car, Check, CreditCard, FileText, HelpCircle, ImageIcon, MessageCircle, Paperclip, ShieldAlert, UserRound, Wallet, X } from 'lucide-react-native';
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
const shortPlace = (label: string) => label.replace(/^[^·]+·\s*/, '');
/** Reason groups, in the order a person thinks about them. */
const CATEGORY_ORDER: { id: SupportTicket['category'] | 'wallet'; label: string; icon: (size?: number) => ReactNode; tile: () => string }[] = [
  { id: 'safety', label: 'Sécurité', icon: (n = 20) => <ShieldAlert size={n} color={colors.danger} strokeWidth={1.9} />, tile: () => colors.dangerSoft },
  { id: 'ride', label: 'Course', icon: (n = 20) => <Car size={n} color={colors.accent} strokeWidth={1.9} />, tile: () => colors.mauveSoft },
  { id: 'payment', label: 'Paiement et prix', icon: (n = 20) => <CreditCard size={n} color={colors.info} strokeWidth={1.9} />, tile: () => colors.infoSoft },
  { id: 'wallet', label: 'Portefeuille', icon: (n = 20) => <Wallet size={n} color={colors.accent} strokeWidth={1.9} />, tile: () => colors.mauveSoft },
  { id: 'account', label: 'Compte', icon: (n = 20) => <UserRound size={n} color={colors.accent} strokeWidth={1.9} />, tile: () => colors.mauveSoft },
  { id: 'other', label: 'Autre', icon: (n = 20) => <HelpCircle size={n} color={colors.muted} strokeWidth={1.9} />, tile: () => colors.background },
];
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
  const rides = useQuery({ queryKey: ['naya', accountId, 'support-rides'], queryFn: () => api.rides.history(0, 10), enabled: defaultCategory !== 'account' });
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
  const all = [...reasons, ...GENERAL.map((g) => ({ ...g, evidenceRequired: false }))];
  const groups = CATEGORY_ORDER.map((c) => ({ ...c, items: all.filter((r) => r.category === c.id) })).filter((g) => g.items.length);
  const [picking, setPicking] = useState(true);
  const rideInfo = rides.data?.items.find((r) => r.id === ride);
  const card = { backgroundColor: colors.surface, borderRadius: 20, shadowColor: '#2E202C', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 } as const;
  const label12 = { fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' as const, marginLeft: 4 };
  const choose = (id: string) => {
    haptic.select();
    setChoice(id);
    setErrors({});
    setPicking(false);
  };
  const selectedCat = CATEGORY_ORDER.find((c) => c.id === (reason?.category ?? general?.category));

  return (
    <Screen keyboard header={<Header title={rideId || ride ? 'Signaler un problème' : 'Nouvelle demande'} onBack={onBack} />} footer={<Button label="Envoyer" size="major" full loading={create.isPending} onPress={submit} testID="submit-ticket" />}>
      <View style={{ gap: 22, marginTop: 4 }}>
        {/* ── Concerned ride ── */}
        {ride ? (
          <View style={[card, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }]}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}><Car size={20} color={colors.accent} strokeWidth={1.9} /></View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>{rideInfo ? `${shortPlace(rideInfo.route.stops[0]!.label)} → ${shortPlace(rideInfo.route.stops[rideInfo.route.stops.length - 1]!.label)}` : `Course ${ride}`}</Text>
              <Text tone="muted" numberOfLines={1} numeric style={{ fontSize: 13, lineHeight: 18 }}>{rideInfo ? `${formatShort(rideInfo.completedAt ?? rideInfo.requestedAt)} · ${ride}` : 'Course concernée'}</Text>
            </View>
            {!rideId ? <PressableScale onPress={() => setRide(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retirer la course"><X size={18} color={colors.muted} /></PressableScale> : null}
          </View>
        ) : null}

        {/* ── Reason ── */}
        <View style={{ gap: 10 }}>
          <Text weight="semibold" tone="muted" style={label12}>Motif</Text>
          {label && !picking ? (
            <PressableScale onPress={() => { haptic.select(); setPicking(true); }} accessibilityRole="button" accessibilityLabel={`Motif : ${label}. Modifier`} style={[card, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 1.5, borderColor: colors.accent }]}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: selectedCat?.tile() ?? colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }}>{selectedCat?.icon()}</View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20 }}>{label}</Text>
                <Text tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{selectedCat?.label}</Text>
              </View>
              <Text weight="semibold" tone="accent" style={{ fontSize: 14, lineHeight: 18 }}>Modifier</Text>
            </PressableScale>
          ) : (
            <View style={{ gap: 14 }} accessibilityRole="radiogroup" accessibilityLabel="Motif">
              {groups.map((g) => (
                <View key={g.id} style={[card, { overflow: 'hidden' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: g.tile(), alignItems: 'center', justifyContent: 'center' }}>{g.icon(15)}</View>
                    <Text weight="semibold" tone="muted" style={{ fontSize: 13, lineHeight: 18 }}>{g.label}</Text>
                  </View>
                  {g.items.map((r, i) => {
                    const on = choice === r.id;
                    return (
                      <PressableScale key={r.id} testID={`reason-${r.id}`} onPress={() => choose(r.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} pressedScale={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                        <Text weight={on ? 'semibold' : 'regular'} tone={on ? 'accent' : 'ink'} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>{r.label}</Text>
                        {r.evidenceRequired ? <Text tone="muted" style={{ fontSize: 12, lineHeight: 16 }}>Photo requise</Text> : null}
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 0 : 2, borderColor: colors.line, backgroundColor: on ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on ? <Check size={13} color={colors.inverse} strokeWidth={3} /> : null}</View>
                      </PressableScale>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
          {errors.reason ? <Text tone="danger" style={{ marginLeft: 4 }}>{errors.reason}</Text> : null}
          {reason?.category === 'safety' ? <StatusBanner compact tone="danger" title="Urgence : 19 (police) · 15 (SAMU)" message="signalements de sécurité traités en priorité" /> : null}
        </View>

        {/* ── Ride picker when opened from Aide ── */}
        {!rideId && rides.data?.items.length ? (
          <View style={{ gap: 10 }}>
            <Text weight="semibold" tone="muted" style={label12}>Course concernée</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {rides.data.items.map((r) => (
                <Pill key={r.id} label={`${formatShort(r.completedAt ?? r.requestedAt)} · ${shortPlace(r.route.stops[r.route.stops.length - 1]!.label)}`} selected={ride === r.id} onPress={() => setRide(r.id)} testID={`ride-${r.id}`} />
              ))}
              <Pill label="Aucune course" selected={!ride} onPress={() => setRide(null)} />
            </View>
          </View>
        ) : null}

        {/* ── Description ── */}
        <View style={{ gap: 10 }}>
          <Text weight="semibold" tone="muted" style={label12}>Ce qui s’est passé</Text>
          <FormField label="Décrivez la situation" value={body} onChangeText={setBody} error={errors.body} multiline numberOfLines={6} textAlignVertical="top" placeholder="Quand, où, ce que vous avez constaté, ce que vous attendez de Naya…" testID="ticket-body" maxLength={2000} inputStyle={{ minHeight: 120 }} />
          <Text tone="muted" numeric align="right" style={{ fontSize: 12, lineHeight: 16, marginRight: 4 }}>{body.length} / 2000</Text>
        </View>

        {/* ── Evidence ── */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text weight="semibold" tone="muted" style={label12}>Preuves {reason?.evidenceRequired ? '· obligatoire' : '· facultatif'}</Text>
            <Text tone="muted" numeric style={{ fontSize: 12, lineHeight: 16, marginRight: 4 }}>{attachments.length}/{MAX_ATTACHMENTS}</Text>
          </View>
          {attachments.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {attachments.map((a) => (
                <View key={a.id}>
                  {a.pdf ? (
                    <View style={{ width: 76, height: 76, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
                      <FileText size={24} color={colors.accent} />
                      <Text variant="micro">PDF</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: a.uri }} style={{ width: 76, height: 76, borderRadius: 16 }} contentFit="cover" accessibilityLabel="Pièce jointe" />
                  )}
                  <View style={{ position: 'absolute', top: -8, right: -8 }}>
                    <IconButton variant="solid" size={28} icon={<X size={14} color={colors.ink} />} accessibilityLabel="Retirer la pièce jointe" onPress={() => setAttachments((l) => l.filter((x) => x.id !== a.id))} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {attachments.length < MAX_ATTACHMENTS ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([
                ['camera', 'Photo', <Camera key="c" size={20} color={colors.accent} strokeWidth={1.9} />, 'attach-camera'],
                ['library', 'Galerie', <ImageIcon key="l" size={20} color={colors.accent} strokeWidth={1.9} />, 'attach'],
                ['document', 'PDF', <FileText key="d" size={20} color={colors.accent} strokeWidth={1.9} />, 'attach-document'],
              ] as const).map(([kind, text, icon, id]) => (
                <PressableScale key={kind} testID={id} disabled={uploading} onPress={() => attach(kind)} accessibilityRole="button" accessibilityLabel={kind === 'camera' ? 'Prendre une photo' : kind === 'library' ? 'Photo ou capture' : 'Document PDF'} style={[card, { flex: 1, height: 76, alignItems: 'center', justifyContent: 'center', gap: 6, opacity: uploading ? 0.5 : 1 }]}>
                  {uploading ? <ActivityIndicator color={colors.accent} /> : icon}
                  <Text weight="semibold" style={{ fontSize: 13, lineHeight: 18 }}>{text}</Text>
                </PressableScale>
              ))}
            </View>
          ) : null}
          <Text tone="muted" style={{ fontSize: 13, lineHeight: 18, marginHorizontal: 4 }}>Photos, captures d’écran, reçus ou documents. Privés, vus par l’équipe Naya seulement.</Text>
          {errors.attachments ? <Text tone="danger" style={{ marginLeft: 4 }}>{errors.attachments}</Text> : null}
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
