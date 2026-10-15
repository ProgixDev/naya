import { Attachment } from './Attachment';
import { useTheme } from './../core/theme';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, FileText, ImageIcon, Inbox, X } from 'lucide-react-native';
import { errorMessage, qk } from '@naya/api';
import { useApi } from '@naya/api/react';
import { formatShort, supportTicketSchema, type SupportTicket } from '@naya/domain';
import { colors, radius } from '@naya/tokens';
import { Screen } from '../Screen';
import { PressableScale } from '../PressableScale';
import { GlossLayers, glossShadow } from '../Material';
import { Header } from '../Header';
import { Text } from '../Text';
import { Button, IconButton } from '../Button';
import { FormField } from '../Form';
import { ErrorState, SkeletonList, StatusBanner } from '../Feedback';
import { ListGroup, ListRow } from '../List';
import { StatusIcon } from '../StatusIcon';
import { HIDDEN_GLYPH, Icon } from '../Icon';
import { toast } from '../Toast';
import { haptic } from '../haptics';
import { pickFile, uploadFile } from './uploads';

type Category = SupportTicket['category'];
type Role = 'passenger' | 'driver';

const isClosed = (t: Pick<SupportTicket, 'status'>) => t.status === 'resolved' || t.status === 'rejected';

/** C6: the ticket's state glyph. The word shows only where `showLabel` asks for it (R1). */
export function TicketStatus({ ticket, showLabel = 'auto' }: { ticket: Pick<SupportTicket, 'status'>; showLabel?: boolean | 'auto' }) {
  useTheme();
  return <StatusIcon kind="support" state={ticket.status} showLabel={showLabel} />;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** P16 / D18 list (P-47): the C6 glyph on each row, counts in the section labels, a plain empty state. */
export function TicketListScreen({ accountId, onBack, onOpen, onCreate }: { accountId: string; onBack: () => void; onOpen: (id: string) => void; onCreate: () => void }) {
  useTheme();
  const api = useApi();
  const q = useQuery({ queryKey: qk.tickets(accountId), queryFn: api.support.list });
  const current = q.data?.filter((t) => !isClosed(t)) ?? [];
  const closed = q.data?.filter(isClosed) ?? [];
  const row = (t: SupportTicket) => (
    <ListRow
      key={t.id}
      testID={`ticket-${t.id}`}
      title={t.subject}
      subtitle={`${t.id}${t.rideId ? ` · course ${t.rideId}` : ''} · ${formatShort(t.updatedAt)}`}
      status={{ kind: 'support', state: t.status }}
      onPress={() => onOpen(t.id)}
    />
  );
  return (
    <Screen header={<Header title="Mes demandes" onBack={onBack} />} footer={<Button label="Nouvelle demande" full onPress={onCreate} testID="new-ticket" />}>
      <View style={{ marginTop: 4, gap: 24 }}>
        {q.isLoading ? <SkeletonList rows={3} /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {q.data && q.data.length === 0 ? (
          // §5.7: one glyph, one line, one grey line; the footer holds the one button.
          <View testID="tickets-empty" style={{ alignItems: 'center', gap: 8, paddingTop: 48, paddingHorizontal: 16 }}>
            <Inbox size={48} color={colors.muted} strokeWidth={2} {...HIDDEN_GLYPH} style={{ marginBottom: 4 }} />
            <Text variant="label" weight="semibold" align="center">
              Aucune demande
            </Text>
            <Text variant="caption" tone="muted" align="center" style={{ maxWidth: 300 }}>
              Vos échanges avec l’équipe Naya apparaîtront ici.
            </Text>
          </View>
        ) : null}
        {current.length ? <ListGroup label={plural(current.length, 'demande en cours', 'demandes en cours')}>{current.map(row)}</ListGroup> : null}
        {closed.length ? <ListGroup label={plural(closed.length, 'demande terminée', 'demandes terminées')}>{closed.map(row)}</ListGroup> : null}
      </View>
    </Screen>
  );
}

/** Step 1 (P-48, D-33): one category per row, no sub-reasons. « Autre sujet » is not the « Autre » reason. */
const CATEGORIES: { value: Category; label: string; hint: Record<Role, string> }[] = [
  { value: 'ride', label: 'Course', hint: { passenger: 'Course non effectuée, véhicule, objet perdu', driver: 'Course non effectuée, véhicule, objet oublié' } },
  { value: 'payment', label: 'Paiement', hint: { passenger: 'Prix d’une course, moyen de paiement', driver: 'Prix d’une course, encaissement' } },
  { value: 'safety', label: 'Sécurité', hint: { passenger: 'Comportement, accident, incident', driver: 'Comportement, accident, incident' } },
  { value: 'wallet', label: 'Portefeuille', hint: { passenger: 'Solde et recharges', driver: 'Recharges, retraits, commission' } },
  { value: 'account', label: 'Compte', hint: { passenger: 'Identité, profil, connexion', driver: 'Dossier, documents, véhicule' } },
  { value: 'other', label: 'Autre sujet', hint: { passenger: 'Toute autre question', driver: 'Toute autre question' } },
];

/** Reasons about the person asking make no sense on her own form. */
const NOT_FOR: Record<Role, string> = { passenger: 'passenger_behavior', driver: 'driver_behavior' };

type Picked = { id: string; uri: string; pdf: boolean };

/**
 * P16 creation / D18-form (P-48). Step 1 is the category list; step 2 is the form (reason, subject,
 * message, up to 3 attachments). A `defaultCategory` (help topic, ledger, verification) opens step 2
 * directly; a ride alone keeps step 1 and names the ride in the subtitle.
 */
export function TicketCreateScreen({ accountId, rideId, defaultCategory, role, onBack, onCreated }: { accountId: string; rideId: string | null; defaultCategory?: Category; role: Role; onBack: () => void; onCreated: (id: string) => void }) {
  useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const [category, setCategory] = useState<Category | null>(defaultCategory ?? null);
  const [reasonId, setReasonId] = useState<string | undefined>();
  const catalog = useQuery({ queryKey: ['naya', accountId, 'catalog'], queryFn: api.prototype.catalog });
  const [subject, setSubject] = useState('');
  const [subjectEdited, setSubjectEdited] = useState(false);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Picked[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<'library' | 'document' | null>(null);

  const reasons = (catalog.data?.reasons ?? []).filter((r) => r.enabled && r.category === category && r.id !== NOT_FOR[role]);
  // A category with one reason (« Autre ») is not a choice: it is sent without asking (D-33).
  const single = reasons.length === 1 ? reasons[0] : undefined;
  const chosenId = single?.id ?? reasonId;
  const reason = reasons.find((r) => r.id === chosenId);
  const meta = CATEGORIES.find((c) => c.value === category);
  const fromList = defaultCategory === undefined;

  const toList = () => {
    setCategory(null);
    setReasonId(undefined);
    setErrors({});
  };
  const back = category && fromList ? toList : onBack;
  useEffect(() => {
    // Android only: BackHandler warns on the web (and the dev overlay then covers the screen).
    if (Platform.OS !== 'android' || !(category && fromList)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      toList();
      return true;
    });
    return () => sub.remove();
  }, [category, fromList]);

  const create = useMutation({
    mutationFn: () => api.support.create({ rideId, category: category ?? 'other', reasonId: chosenId, subject, body, attachments: attachments.map((a) => a.id) }),
    onSuccess: (t) => {
      haptic.success();
      qc.invalidateQueries({ queryKey: qk.tickets(accountId) });
      toast('Demande envoyée', 'success');
      onCreated(t.id);
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const submit = () => {
    const parsed = supportTicketSchema.safeParse({ rideId, category, reasonId: chosenId, subject, body, attachments: attachments.map((a) => a.id) });
    if (!parsed.success) {
      const f: Record<string, string> = {};
      for (const i of parsed.error.issues) f[String(i.path[0])] = i.message;
      setErrors(f);
      haptic.warning();
      return;
    }
    if (reason?.evidenceRequired && !attachments.length) {
      setErrors({ attachments: 'Une photo ou un PDF est requis pour ce motif.' });
      haptic.warning();
      return;
    }
    setErrors({});
    create.mutate();
  };
  const pickReason = (id: string, label: string) => {
    const next = id === reasonId ? undefined : id;
    setReasonId(next);
    // The reason is a fair subject until she writes her own.
    if (!subjectEdited) setSubject(next ? label : '');
  };
  const attach = async (kind: 'library' | 'document') => {
    const file = await pickFile(kind);
    if (file === 'denied') return toast('Autorisez l’accès aux photos dans les réglages pour joindre une image.', 'danger');
    if (!file) return;
    setUploading(kind);
    try {
      const up = await uploadFile(api, file, 'support_attachment');
      setAttachments((a) => [...a, { id: up.id, uri: file.uri, pdf: file.mimeType === 'application/pdf' }]);
      setErrors((e) => ({ ...e, attachments: '' }));
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setUploading(null);
    }
  };

  const subtitle = [meta?.label, rideId ? `course ${rideId}` : null].filter(Boolean).join(' · ');

  if (!category) {
    return (
      <Screen testID="ticket-categories" header={<Header title="Nouvelle demande" subtitle={rideId ? `À propos de la course ${rideId}` : 'Choisissez un sujet'} onBack={onBack} />}>
        <View style={{ marginTop: 4 }}>
          <ListGroup label="Sujet">
            {CATEGORIES.map((c) => (
              <ListRow
                key={c.value}
                title={c.label}
                subtitle={c.hint[role]}
                onPress={() => {
                  setCategory(c.value);
                  setReasonId(undefined);
                }}
                testID={`category-${c.value}`}
              />
            ))}
          </ListGroup>
        </View>
      </Screen>
    );
  }

  const canAttach = attachments.length < 3;
  return (
    <Screen
      testID="ticket-form"
      keyboard
      header={<Header title="Nouvelle demande" subtitle={subtitle || undefined} onBack={back} />}
      footer={<Button label="Envoyer la demande" full loading={create.isPending} onPress={submit} testID="submit-ticket" />}
    >
      <View style={{ gap: 20, marginTop: 4 }}>
        {/* Moroccan numbers (PAX-11, PRD-23): 15 is the Protection civile, not the French SAMU. */}
        {category === 'safety' ? <StatusBanner tone="danger" title="En cas de danger, appelez d’abord" message="Police 19 · Protection civile 15 (pompiers et ambulances) · Gendarmerie royale 177 hors agglomération · 112 depuis un mobile. Une demande n’est pas un appel d’urgence." testID="support-emergency-numbers" /> : null}
        {reasons.length > 1 ? (
          <ListGroup label="Motif (facultatif)">
            {reasons.map((r) => (
              <ListRow key={r.id} title={r.label} subtitle={r.evidenceRequired ? 'Photo ou PDF requis' : undefined} selected={r.id === reasonId} onPress={() => pickReason(r.id, r.label)} testID={`reason-${r.id}`} />
            ))}
          </ListGroup>
        ) : null}
        <View style={{ gap: 14 }}>
          <FormField
            label="Objet"
            value={subject}
            onChangeText={(v) => {
              setSubject(v);
              setSubjectEdited(v.length > 0);
            }}
            error={errors.subject}
            example="Ex. : montant de la course"
            testID="ticket-subject"
            maxLength={120}
          />
          <FormField label="Votre message" value={body} onChangeText={setBody} error={errors.body} multiline numberOfLines={5} textAlignVertical="top" example="Décrivez ce qui s’est passé." testID="ticket-body" maxLength={2000} inputStyle={{ minHeight: 96 }} />
        </View>
        <View style={{ gap: 10 }}>
          {attachments.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {attachments.map((a, i) => (
                <View key={a.id} testID={`ticket-attachment-${i}`}>
                  {a.pdf ? (
                    <View style={{ width: 72, height: 72, borderRadius: radius.row, backgroundColor: colors.mauveSoft, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityRole="image" accessibilityLabel="Document PDF joint">
                      <Icon icon={FileText} size={24} color={colors.accent} scale={false} />
                    </View>
                  ) : (
                    <Image source={{ uri: a.uri }} style={{ width: 72, height: 72, borderRadius: radius.row }} contentFit="cover" accessibilityLabel="Photo jointe" />
                  )}
                  <View style={{ position: 'absolute', top: -8, right: -8 }}>
                    <IconButton variant="solid" size={28} icon={<X size={14} color={colors.ink} />} accessibilityLabel="Retirer la pièce jointe" onPress={() => setAttachments((l) => l.filter((x) => x.id !== a.id))} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {canAttach ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Button label="Photo" variant="secondary" size="compact" icon={<Icon icon={ImageIcon} size={16} color={colors.accent} />} loading={uploading === 'library'} disabled={!!uploading} onPress={() => attach('library')} testID="attach" />
              <Button label="PDF" variant="secondary" size="compact" icon={<Icon icon={FileText} size={16} color={colors.accent} />} loading={uploading === 'document'} disabled={!!uploading} onPress={() => attach('document')} testID="attach-pdf" />
            </View>
          ) : null}
          {errors.attachments ? (
            <Text variant="caption" tone="danger" testID="ticket-attachments-error">
              {errors.attachments}
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              {reason?.evidenceRequired ? 'Une photo ou un PDF est requis pour ce motif. ' : ''}Pièces jointes privées, vues par l’équipe support seulement.
            </Text>
          )}
        </View>
      </View>
    </Screen>
  );
}

/** P16-status / P16-reply / D18-status / D18-reply (P-49): the C6 state in the header, the thread, the composer. */
export function TicketThreadScreen({ accountId, ticketId, onBack, onCreate }: { accountId: string; ticketId: string; onBack: () => void; onCreate?: () => void }) {
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
  const footer = !t ? undefined : !isClosed(t) ? (
    <View style={{ gap: 8 }}>
      {/* awaiting_user ★: the prompt sits at the composer, where she answers (C6). */}
      {t.status === 'awaiting_user' ? (
        <Text variant="caption" weight="semibold" testID="reply-hint">
          L’équipe attend votre réponse
        </Text>
      ) : null}
      <Composer value={text} onChange={setText} sending={send.isPending} onSend={() => send.mutate()} attention={t.status === 'awaiting_user'} />
    </View>
  ) : onCreate ? (
    <Button label="Nouvelle demande" variant="secondary" full onPress={onCreate} testID="ticket-new" />
  ) : undefined;
  return (
    <Screen
      keyboard
      header={
        <Header
          title={t?.subject ?? 'Demande'}
          subtitle={t ? `${t.id}${t.rideId ? ` · course ${t.rideId}` : ''}` : undefined}
          onBack={onBack}
          right={t ? <StatusIcon kind="support" state={t.status} showLabel announce testID="ticket-status" /> : undefined}
        />
      }
      footer={footer}
    >
      {q.isLoading ? <SkeletonList rows={3} /> : null}
      {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
      {t ? (
        <View style={{ gap: 12, marginTop: 4 }}>
          {/* A rejection is a problem: it keeps its reason (principle 3). A resolution is already the last message. */}
          {t.status === 'rejected' && t.resolution ? <StatusBanner kind="support" state="rejected" title="Motif du rejet" message={t.resolution.note} testID="ticket-rejection" /> : null}
          <View style={{ gap: 10, marginTop: 4 }} accessibilityLabel="Échanges">
            {t.messages.map((m) => {
              const mine = m.author === 'user';
              return (
                <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', backgroundColor: mine ? colors.selected : m.author === 'system' ? 'transparent' : colors.surface, borderRadius: 18, padding: m.author === 'system' ? 0 : 12, borderWidth: m.author === 'agent' ? 1 : 0, borderColor: colors.hairline }}>
                  {m.author !== 'user' ? (
                    <Text variant="caption" tone="accent" weight="semibold" style={{ marginBottom: 4 }}>
                      {m.authorName}
                    </Text>
                  ) : null}
                  <Text variant="label" tone={m.author === 'system' ? 'muted' : 'ink'}>
                    {m.body}
                  </Text>
                  {m.attachments.length ? (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {m.attachments.map((id) => (
                        <Attachment key={id} id={id} accountId={accountId} caption={false} />
                      ))}
                    </View>
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
function Composer({ value, onChange, sending, onSend, attention }: { value: string; onChange: (v: string) => void; sending: boolean; onSend: () => void; attention?: boolean }) {
  useTheme();
  const ready = !!value.trim() && !sending;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 52, borderRadius: 26, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, backgroundColor: colors.surface, borderWidth: attention ? 2 : 1, borderColor: attention ? colors.accent : colors.outline }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Votre réponse"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={2000}
        accessibilityLabel="Répondre"
        testID="reply-input"
        style={[{ flex: 1, minHeight: 40, maxHeight: 120, paddingTop: 10, paddingBottom: 10, fontFamily: 'Inter_500Medium', fontSize: 16, color: colors.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
      />
      <PressableScale onPress={onSend} disabled={!ready} accessibilityRole="button" accessibilityLabel="Envoyer" accessibilityState={{ disabled: !ready, busy: sending }} testID="send-reply" hitSlop={4} style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ready ? undefined : colors.selected }, ready ? glossShadow('accent') : null]}>
        {ready ? <GlossLayers tone="accent" radius={20} /> : null}
        <View>{sending ? <ActivityIndicator color={colors.accent} /> : <ArrowUp size={20} color={ready ? colors.inverse : colors.disabledText} />}</View>
      </PressableScale>
    </View>
  );
}
