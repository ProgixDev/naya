import { DocThumb, DocViewer } from '../components/DocViewer';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import type { TicketHistoryEntry } from '@naya/domain';
import { api } from '../lib/api';
import { fmtDateTime, money } from '../lib/format';
import { Banner, Button, Card, DefinitionList, Dialog, ErrorState, Field, Input, PageHeader, Skeleton, Textarea, toast, cx } from '../components/ui';
import { PaymentBadge, RideBadge, TicketBadge } from '../components/status';
import { AuditList } from './Audit';

const OUTCOMES = {
  resolved: ['Remboursement accordé', 'Tarif corrigé', 'Avertissement envoyé à la chauffeuse', 'Avertissement envoyé à la cliente', 'Objet restitué', 'Signalement traité', 'Compte mis à jour'],
  rejected: ['Tarif confirmé', 'Preuve insuffisante', 'Hors délai', 'Doublon'],
};
const ACTIONS = ['Remboursement accordé', 'Geste commercial', 'Avertissement envoyé', 'Compte suspendu temporairement', 'Appel à la cliente', 'Appel à la chauffeuse', 'Trajet GPS vérifié', 'Objet retrouvé'];
const CATEGORY = { ride: 'Course', payment: 'Paiement', safety: 'Sécurité', account: 'Compte', wallet: 'Portefeuille', other: 'Autre' } as const;
const HISTORY_TONE: Partial<Record<TicketHistoryEntry['kind'], string>> = { decision: 'text-accent font-semibold', internal_note: 'text-muted italic', action: 'text-ink font-medium' };

/** A08 · Litige : contexte complet, échanges, actions historisées et décision motivée. */
export function TicketPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'ticket', id], queryFn: () => api.admin.ticket(id), refetchInterval: 8000 });
  const [attachment, setAttachment] = useState<string>();
  const [reply, setReply] = useState('');
  const [requestInfo, setRequestInfo] = useState(true);
  const [actionKind, setActionKind] = useState<'action' | 'internal_note'>('action');
  const [actionLabel, setActionLabel] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [decide, setDecide] = useState<'resolved' | 'rejected' | null>(null);
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const fail = (e: unknown) => toast(errorMessage(e), 'danger');
  const send = useMutation({ mutationFn: () => api.admin.replyTicket(id, reply.trim(), requestInfo), onSuccess: () => (setReply(''), toast(requestInfo ? 'Informations demandées' : 'Réponse envoyée', 'success'), invalidate()), onError: fail });
  const analyse = useMutation({ mutationFn: () => api.admin.startAnalysis(id), onSuccess: () => (toast('Analyse commencée', 'success'), invalidate()), onError: fail });
  const act = useMutation({ mutationFn: () => api.admin.ticketAction(id, { kind: actionKind, label: actionLabel.trim(), note: actionNote.trim() || undefined }), onSuccess: () => (setActionLabel(''), setActionNote(''), toast('Ajouté à l’historique', 'success'), invalidate()), onError: fail });
  const resolve = useMutation({ mutationFn: () => api.admin.resolveTicket(id, { outcome: outcome.trim(), note: note.trim(), decision: decide! }), onSuccess: () => (setDecide(null), toast(decide === 'rejected' ? 'Litige rejeté' : 'Litige résolu', 'success'), invalidate()), onError: (e) => setNoteError(errorMessage(e)) });
  if (q.isLoading) return <Skeleton className="mt-6 h-[420px] w-full" />;
  if (q.isError || !q.data) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const { ticket: t, reason, passenger, driver, ride, payments, audit } = q.data;
  const open = t.status !== 'resolved' && t.status !== 'rejected';
  const first = t.messages.find((m) => m.author === 'user');
  const files = t.messages.flatMap((m) => m.attachments.map((a) => ({ id: a, at: m.at, by: m.authorName })));
  const openDecision = (d: 'resolved' | 'rejected') => (setDecide(d), setOutcome(OUTCOMES[d][0]!), setNote(''), setNoteError(null));
  return (
    <>
      <PageHeader
        eyebrow={<Link to="/support" className="hover:text-accent">Support et litiges</Link>}
        title={t.subject}
        subtitle={`${t.id} · ouvert par ${t.userName} (${t.userRole === 'driver' ? 'chauffeuse' : 'cliente'}) le ${fmtDateTime(t.createdAt)}`}
        actions={
          <>
            <TicketBadge status={t.status} />
            {t.status === 'open' ? <Button variant="secondary" loading={analyse.isPending} onClick={() => analyse.mutate()} data-testid="start-analysis">Commencer l’analyse</Button> : null}
            {open ? <Button variant="secondary" onClick={() => openDecision('rejected')} data-testid="reject">Rejeter</Button> : null}
            {open ? <Button onClick={() => openDecision('resolved')} data-testid="resolve">Résoudre</Button> : null}
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          {t.resolution ? (
            <Banner tone={t.status === 'rejected' ? 'danger' : 'success'} title={`Décision : ${t.status === 'rejected' ? 'rejeté' : 'résolu'} · ${t.resolution.outcome}`}>
              {t.resolution.note} · {t.resolution.by} · {fmtDateTime(t.resolution.at)}
            </Banner>
          ) : null}
          <Card title={t.isDispute ? 'Litige' : 'Demande'}>
            <DefinitionList
              items={[
                { term: 'Motif', value: reason?.label ?? 'Non précisé' },
                { term: 'Catégorie', value: CATEGORY[t.category] },
                { term: 'Preuve', value: reason?.evidenceRequired ? 'Obligatoire pour ce motif' : 'Facultative' },
                { term: 'Statut', value: <TicketBadge status={t.status} /> },
              ]}
            />
            <h3 className="mt-5 text-[13px] font-semibold text-muted">Description</h3>
            <p className="mt-1 whitespace-pre-wrap text-[14px]" data-testid="dispute-description">{first?.body ?? '—'}</p>
            <h3 className="mt-5 text-[13px] font-semibold text-muted">Photos et pièces jointes ({files.length})</h3>
            {files.length ? (
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                {files.map((f) => (
                  <div key={f.id}>
                    <DocThumb uploadId={f.id} label="Pièce jointe au litige" onOpen={() => setAttachment(f.id)} />
                    <p className="mt-1 text-[11px] text-muted">{f.by} · {fmtDateTime(f.at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[14px] text-muted">Aucune pièce jointe.</p>
            )}
          </Card>
          <Card title="Échanges">
            <ol className="flex flex-col gap-3">
              {t.messages.map((m) => (
                <li key={m.id} className={cx('max-w-[85%] rounded-2xl px-4 py-3', m.author === 'agent' ? 'ml-auto bg-selected' : m.author === 'system' ? 'bg-transparent px-0 text-muted' : 'bg-background')}>
                  <div className="text-[12px] font-semibold text-accent">{m.authorName}</div>
                  <p className="mt-1 whitespace-pre-wrap text-[14px]">{m.body}</p>
                  {m.attachments.length ? <div className="mt-3 grid grid-cols-2 gap-2">{m.attachments.map((a) => <DocThumb key={a} uploadId={a} label="Pièce jointe au litige" onOpen={() => setAttachment(a)} />)}</div> : null}
                  <div className="mt-1 text-[11px] text-muted">{fmtDateTime(m.at)}</div>
                </li>
              ))}
            </ol>
            {open ? (
              <form
                className="mt-5 flex flex-col gap-3 border-t border-line pt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reply.trim()) send.mutate();
                }}
              >
                <Field label="Répondre à la personne">
                  {(fid, d) => <Textarea id={fid} aria-describedby={d} value={reply} onChange={(e) => setReply(e.target.value)} data-testid="agent-reply" />}
                </Field>
                <label className="inline-flex items-center gap-2 text-[14px]">
                  <input type="checkbox" className="h-4 w-4 accent-[#6B3657]" checked={requestInfo} onChange={(e) => setRequestInfo(e.target.checked)} data-testid="request-info" />
                  Demander des informations complémentaires (statut « Informations demandées »)
                </label>
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" disabled={!reply.trim()} loading={send.isPending} data-testid="send-agent-reply">
                    {requestInfo ? 'Demander les informations' : 'Envoyer la réponse'}
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
          <Card title="Actions effectuées et notes internes">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (actionLabel.trim().length >= 3) act.mutate();
              }}
            >
              <div className="flex gap-2" role="radiogroup" aria-label="Type">
                {(['action', 'internal_note'] as const).map((k) => (
                  <Button key={k} type="button" size="sm" variant={actionKind === k ? 'primary' : 'secondary'} onClick={() => setActionKind(k)}>
                    {k === 'action' ? 'Action effectuée' : 'Note interne'}
                  </Button>
                ))}
              </div>
              <Field label={actionKind === 'action' ? 'Action' : 'Titre de la note'} hint="Jamais visible par la cliente ou la chauffeuse.">
                {(fid, d) => (
                  <>
                    <Input id={fid} aria-describedby={d} list="ticket-actions" value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} data-testid="action-label" />
                    <datalist id="ticket-actions">{ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
                  </>
                )}
              </Field>
              <Field label="Détails (facultatif)">
                {(fid) => <Textarea id={fid} value={actionNote} onChange={(e) => setActionNote(e.target.value)} />}
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="secondary" disabled={actionLabel.trim().length < 3} loading={act.isPending} data-testid="add-action">Ajouter à l’historique</Button>
              </div>
            </form>
          </Card>
          <Card title="Historique">
            <ol className="flex flex-col gap-2" data-testid="ticket-history">
              {(t.history ?? []).slice().reverse().map((h, i) => (
                <li key={i} className="border-t border-line pt-2 text-[13px] first:border-0 first:pt-0">
                  <span className="tabular text-muted">{fmtDateTime(h.at)}</span> · <span className="text-muted">{h.by}</span> ·{' '}
                  <span className={HISTORY_TONE[h.kind]}>{h.kind === 'internal_note' ? `Note interne · ${h.label}` : h.label}</span>
                  {h.note ? <p className="mt-0.5 whitespace-pre-wrap text-muted">{h.note}</p> : null}
                </li>
              ))}
              {!t.history?.length ? <li className="text-[14px] text-muted">Historique détaillé indisponible pour cette ancienne demande.</li> : null}
            </ol>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card title="Personnes">
            <DefinitionList
              items={[
                { term: 'Cliente', value: passenger ? `${passenger.name} · ${passenger.phone}` : '—' },
                { term: 'Chauffeuse', value: driver ? `${driver.name} · ${driver.phone}` : ride ? 'Non attribuée' : '—' },
                ...(ride?.driver ? [{ term: 'Véhicule', value: `${ride.driver.vehicle.make} ${ride.driver.vehicle.model} · ${ride.driver.vehicle.color} · ${ride.driver.vehicle.plate}` }] : []),
              ]}
            />
          </Card>
          {ride ? (
            <Card title={`Course ${ride.id}`} action={<Link to={`/courses/${ride.id}`} className="text-[13px] font-semibold text-accent">Ouvrir</Link>}>
              <DefinitionList
                items={[
                  { term: 'Date / heure', value: `${fmtDateTime(ride.requestedAt)}${ride.completedAt ? ` → ${fmtDateTime(ride.completedAt)}` : ''}` },
                  { term: 'Trajet', value: ride.route.stops.map((s) => s.label).join(' → ') },
                  { term: 'Statut', value: <RideBadge status={ride.status} /> },
                  { term: 'Service', value: ride.terms.service?.name ?? 'Naya Standard' },
                  { term: 'Prix figé', value: money(ride.terms.breakdown.total) },
                  { term: 'Paiement', value: ride.paymentMethod.label },
                ]}
              />
              {payments.length ? (
                <ul className="mt-4 flex flex-col gap-2">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-2xl bg-background px-4 py-2.5 text-[13px]">
                      <span>{p.id} · {money(p.amount)}</span>
                      <PaymentBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : (
            <Card title="Contexte"><p className="text-[14px] text-muted">Demande sans course liée.</p></Card>
          )}
          <Card title="Journal d’audit">{audit.length ? <AuditList events={audit} compact /> : <p className="text-[14px] text-muted">Aucun événement d’audit pour cette demande.</p>}</Card>
        </div>
      </div>
      <DocViewer uploadId={attachment} label="Pièce jointe au litige" open={!!attachment} onClose={() => setAttachment(undefined)} />
      <Dialog
        open={!!decide}
        onClose={() => setDecide(null)}
        busy={resolve.isPending}
        testId="resolve-dialog"
        title={decide === 'rejected' ? 'Rejeter le litige ?' : 'Résoudre le litige ?'}
        description="La personne verra la décision et la note. La décision est inscrite à l’historique et au journal d’audit."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecide(null)}>Annuler</Button>
            <Button
              loading={resolve.isPending}
              data-testid="confirm-resolve"
              onClick={() => {
                if (outcome.trim().length < 3) return setNoteError('Indiquez la décision.');
                if (note.trim().length < 10) return setNoteError('Expliquez la décision (10 caractères minimum).');
                setNoteError(null);
                resolve.mutate();
              }}
            >
              {decide === 'rejected' ? 'Confirmer le rejet' : 'Confirmer la résolution'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Décision prise">
            {(fid) => (
              <>
                <Input id={fid} list="outcomes" value={outcome} onChange={(e) => setOutcome(e.target.value)} data-testid="resolve-outcome" />
                <datalist id="outcomes">{(decide ? OUTCOMES[decide] : []).map((o) => <option key={o} value={o} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Explication pour la personne" error={noteError}>
            {(fid, d) => <Textarea id={fid} aria-describedby={d} value={note} onChange={(e) => setNote(e.target.value)} data-testid="resolve-note" />}
          </Field>
        </div>
      </Dialog>
    </>
  );
}
