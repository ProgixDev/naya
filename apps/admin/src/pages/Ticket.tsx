import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import { api } from '../lib/api';
import { fmtDateTime, money } from '../lib/format';
import { Banner, Button, Card, DefinitionList, Dialog, ErrorState, Field, Input, PageHeader, Skeleton, Textarea, toast, cx } from '../components/ui';
import { PaymentBadge, RideBadge, TicketBadge } from '../components/status';
import { AuditList } from './Audit';

const OUTCOMES = ['Tarif confirmé', 'Remboursement accordé', 'Information transmise', 'Signalement traité', 'Compte mis à jour'];

/** A08 · Fil d’une demande, réponse et résolution motivée. */
export function TicketPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'ticket', id], queryFn: () => api.admin.ticket(id), refetchInterval: 8000 });
  const [reply, setReply] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [outcome, setOutcome] = useState(OUTCOMES[0]!);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const send = useMutation({ mutationFn: () => api.admin.replyTicket(id, reply.trim()), onSuccess: () => (setReply(''), toast('Réponse envoyée', 'success'), invalidate()), onError: (e) => toast(errorMessage(e), 'danger') });
  const resolve = useMutation({ mutationFn: () => api.admin.resolveTicket(id, { outcome, note: note.trim() }), onSuccess: () => (setResolveOpen(false), toast('Demande résolue', 'success'), invalidate()), onError: (e) => setNoteError(errorMessage(e)) });
  if (q.isLoading) return <Skeleton className="mt-6 h-[420px] w-full" />;
  if (q.isError || !q.data) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const { ticket: t, ride, payments, audit } = q.data;
  const open = t.status !== 'resolved';
  return (
    <>
      <PageHeader eyebrow={<Link to="/support" className="hover:text-accent">Support</Link>} title={t.subject} subtitle={`${t.id} · ${t.userName} · ${t.userRole === 'driver' ? 'chauffeuse' : 'passagère'} · ouverte le ${fmtDateTime(t.createdAt)}`} actions={<><TicketBadge status={t.status} />{open ? <Button onClick={() => (setResolveOpen(true), setNoteError(null))} data-testid="resolve">Résoudre</Button> : null}</>} />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          {t.resolution ? <Banner tone="success" title={`Résolue · ${t.resolution.outcome}`}>{t.resolution.note} · {t.resolution.by} · {fmtDateTime(t.resolution.at)}</Banner> : null}
          <Card title="Échanges">
            <ol className="flex flex-col gap-3">
              {t.messages.map((m) => (
                <li key={m.id} className={cx('max-w-[85%] rounded-2xl px-4 py-3', m.author === 'agent' ? 'ml-auto bg-selected' : m.author === 'system' ? 'bg-transparent px-0 text-muted' : 'bg-background')}>
                  <div className="text-[12px] font-semibold text-accent">{m.authorName}</div>
                  <p className="mt-1 whitespace-pre-wrap text-[14px]">{m.body}</p>
                  {m.attachments.length ? <p className="mt-1 text-[12px] text-muted">{m.attachments.length} pièce(s) jointe(s) · {m.attachments.join(', ')}</p> : null}
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
                <Field label="Répondre à la personne" hint="La demande passera en « Réponse attendue ».">
                  {(fid, d) => <Textarea id={fid} aria-describedby={d} value={reply} onChange={(e) => setReply(e.target.value)} data-testid="agent-reply" />}
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" disabled={!reply.trim()} loading={send.isPending} data-testid="send-agent-reply">
                    Envoyer la réponse
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          {ride ? (
            <Card title={`Course ${ride.id}`} action={<Link to={`/courses/${ride.id}`} className="text-[13px] font-semibold text-accent">Ouvrir</Link>}>
              <DefinitionList items={[{ term: 'Trajet', value: ride.route.stops.map((s) => s.label).join(' → ') }, { term: 'Statut', value: <RideBadge status={ride.status} /> }, { term: 'Prix figé', value: money(ride.terms.breakdown.total) }, { term: 'Terminée', value: fmtDateTime(ride.completedAt) }]} />
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
            <Card title="Contexte"><p className="text-[14px] text-muted">Demande générale, sans course liée.</p></Card>
          )}
          <Card title="Journal">{audit.length ? <AuditList events={audit} compact /> : <p className="text-[14px] text-muted">Aucun événement d’audit pour cette demande.</p>}</Card>
        </div>
      </div>
      <Dialog
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        busy={resolve.isPending}
        testId="resolve-dialog"
        title="Résoudre la demande ?"
        description="La personne verra l’issue et la note. La résolution est inscrite au journal d’audit."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolveOpen(false)}>Annuler</Button>
            <Button
              loading={resolve.isPending}
              data-testid="confirm-resolve"
              onClick={() => {
                if (note.trim().length < 10) return setNoteError('Expliquez la résolution (10 caractères minimum).');
                setNoteError(null);
                resolve.mutate();
              }}
            >
              Confirmer la résolution
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Issue">
            {(fid) => (
              <>
                <Input id={fid} list="outcomes" value={outcome} onChange={(e) => setOutcome(e.target.value)} data-testid="resolve-outcome" />
                <datalist id="outcomes">{OUTCOMES.map((o) => <option key={o} value={o} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Note de résolution" error={noteError}>
            {(fid, d) => <Textarea id={fid} aria-describedby={d} value={note} onChange={(e) => setNote(e.target.value)} data-testid="resolve-note" />}
          </Field>
        </div>
      </Dialog>
    </>
  );
}
