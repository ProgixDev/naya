import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import { ITEM_LABELS, REQUIRED_ITEMS, type DecisionOutcome, type VerificationItemKey } from '@naya/domain';
import { errorMessage, isApiError } from '@naya/api';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { Badge, Banner, Button, Card, DefinitionList, Dialog, ErrorState, Field, PageHeader, Select, Skeleton, Textarea, toast } from '../components/ui';
import { DocThumb, DocViewer } from '../components/DocViewer';
import { SUBJECT_LABELS, VerificationBadge } from '../components/status';
import { AuditList } from './Audit';

const itemTone = { missing: 'neutral', provided: 'info', accepted: 'success', needs_correction: 'warning' } as const;
const itemLabel = { missing: 'Manquante', provided: 'À examiner', accepted: 'Acceptée', needs_correction: 'À corriger' } as const;

/** A05 · Examen d’un dossier et décision motivée. */
export function CaseReviewPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'case', id], queryFn: () => api.admin.verification(id) });
  const [viewer, setViewer] = useState<{ id?: string; label: string } | null>(null);
  const [dialog, setDialog] = useState<DecisionOutcome | null>(null);
  const [message, setMessage] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [corrections, setCorrections] = useState<Partial<Record<VerificationItemKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin'] });
  };

  const start = useMutation({ mutationFn: () => api.admin.startReview(id), onSuccess: refresh, onError: (e) => toast(errorMessage(e), 'danger') });

  const decide = useMutation({
    mutationFn: () =>
      api.admin.decide(id, {
        outcome: dialog!,
        reasonCode: dialog === 'rejected' ? reasonCode : dialog === 'more_info_requested' ? 'correction' : null,
        message: message.trim(),
        corrections: dialog === 'more_info_requested' ? Object.entries(corrections).filter(([, n]) => n !== undefined).map(([key, note]) => ({ key: key as VerificationItemKey, note: note!.trim() })) : [],
        expectedVersion: q.data!.case.version,
      }),
    onSuccess: (c) => {
      toast(c.status === 'approved' ? 'Dossier approuvé' : c.status === 'rejected' ? 'Dossier refusé' : 'Complément demandé', 'success');
      setDialog(null);
      refresh();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === 'CONFLICT') {
        setConflict(true);
        setDialog(null);
      } else setFormError(errorMessage(e));
    },
  });

  if (q.isLoading) return <Skeleton className="mt-6 h-[480px] w-full" />;
  if (q.isError || !q.data) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const { case: c, user, related, vehicle, audit, rejectionReasons, canDecide } = q.data;
  const decidable = canDecide && (c.status === 'submitted' || c.status === 'in_review');
  const keys = Array.from(new Set([...REQUIRED_ITEMS[c.subject], ...c.items.map((i) => i.key)]));
  const who = `${user.firstName} ${user.lastName}`.trim() || user.phone;
  const subjectWord = c.subject === 'vehicle' ? 'le véhicule' : c.subject === 'driver_identity' ? 'la chauffeuse' : 'la passagère';

  const openDialog = (o: DecisionOutcome) => {
    setDialog(o);
    setFormError(null);
    if (o !== dialog) setMessage('');
    if (o !== 'more_info_requested') setCorrections({});
  };
  const validate = () => {
    if (dialog === 'rejected' && !reasonCode) return 'Choisissez un motif de refus.';
    if (dialog === 'more_info_requested') {
      const list = Object.values(corrections).filter((n) => n !== undefined);
      if (list.length === 0) return 'Sélectionnez au moins une pièce à corriger.';
      if (list.some((n) => n!.trim().length < 3)) return 'Précisez ce qui doit être corrigé pour chaque pièce.';
    }
    if (dialog !== 'approved' && message.trim().length < 10) return 'Expliquez la décision à la personne (10 caractères minimum).';
    return null;
  };

  return (
    <>
      <PageHeader
        eyebrow={<Link to="/verifications" className="hover:text-accent">Vérifications</Link>}
        title="Examiner le dossier"
        subtitle={`${c.id} · ${who} · ${SUBJECT_LABELS[c.subject]} · ${user.cityId.charAt(0).toUpperCase()}${user.cityId.slice(1)}`}
        actions={<VerificationBadge status={c.status} />}
      />
      <div className="flex flex-col gap-5">
        {conflict ? (
          <Banner tone="warning" title="Le dossier a changé pendant votre examen" action={<Button size="sm" variant="secondary" onClick={() => (setConflict(false), q.refetch())}>Recharger</Button>}>
            Une autre décision ou un nouvel envoi a été enregistré. Rechargez avant de décider.
          </Banner>
        ) : null}
        {!canDecide ? <Banner tone="info" title="Lecture seule">Votre rôle permet de consulter ce dossier, pas de le décider.</Banner> : null}
        {c.decision && !decidable ? (
          <Banner tone={c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'danger' : 'warning'} title={`Décision : ${c.status === 'approved' ? 'approuvé' : c.status === 'rejected' ? 'refusé' : 'complément demandé'} par ${c.decision.decidedByName}`}>
            {c.decision.message} · {fmtDateTime(c.decision.decidedAt)}
          </Banner>
        ) : null}
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-5">
            <Card title="Pièces du dossier" subtitle="Documents et selfies fictifs · aucune identité réelle. Aucun jugement n’est fait sur l’apparence.">
              <div className="grid gap-4 sm:grid-cols-2">
                {keys.map((key) => {
                  const item = c.items.find((i) => i.key === key);
                  const status = item?.status ?? 'missing';
                  return (
                    <div key={key} className="flex flex-col gap-2" data-testid={`item-${key}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold">{ITEM_LABELS[key]}</span>
                        <Badge tone={itemTone[status]}>{itemLabel[status]}</Badge>
                      </div>
                      <DocThumb uploadId={item?.uploadIds[0]} label={ITEM_LABELS[key]} onOpen={() => setViewer({ id: item?.uploadIds[0], label: `${ITEM_LABELS[key]} · ${who}` })} />
                      {item?.note ? <p className="text-[12px] text-warning">Demande : {item.note}</p> : null}
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card title={c.subject === 'vehicle' ? 'Véhicule déclaré' : 'Informations déclarées'}>
              {c.subject === 'vehicle' ? (
                c.vehicle ? (
                  <DefinitionList items={[{ term: 'Véhicule', value: `${c.vehicle.make} ${c.vehicle.model}` }, { term: 'Couleur', value: c.vehicle.color }, { term: 'Immatriculation', value: c.vehicle.plate }, { term: 'Année', value: c.vehicle.year }, { term: 'Titulaire', value: who }]} />
                ) : (
                  <p className="text-[14px] text-muted">Aucun véhicule déclaré.</p>
                )
              ) : c.identity ? (
                <DefinitionList items={[{ term: 'Prénom et nom', value: `${c.identity.firstName} ${c.identity.lastName}` }, { term: 'Date de naissance', value: c.identity.birthDate }, { term: 'Pièce', value: c.identity.documentType === 'cin' ? 'Carte d’identité' : c.identity.documentType === 'passport' ? 'Passeport' : 'Titre de séjour' }, { term: 'Numéro', value: c.identity.documentNumber }, { term: 'Téléphone', value: user.phone }]} />
              ) : (
                <p className="text-[14px] text-muted">Informations non renseignées.</p>
              )}
            </Card>
            <Card title="Historique du dossier">
              <ol className="flex flex-col gap-3">
                {[...c.history].reverse().map((h, i) => (
                  <li key={i} className="flex gap-3 text-[14px]">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
                    <div>
                      <div className="font-medium">{h.note ?? h.status}</div>
                      <div className="text-[12px] text-muted">{fmtDateTime(h.at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
          <div className="flex flex-col gap-5">
            <Card title="Décision" subtitle={`${SUBJECT_LABELS[c.subject]} · version ${c.version}`}>
              <ul className="mb-5 flex flex-col gap-2 text-[14px]">
                {['Vérifier la lisibilité de chaque pièce', 'Vérifier la correspondance des informations', 'Motiver toute demande ou tout refus'].map((t) => (
                  <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-muted" aria-hidden />{t}</li>
                ))}
              </ul>
              {decidable ? (
                <div className="flex flex-col gap-2">
                  {c.status === 'submitted' ? (
                    <Button variant="tonal" loading={start.isPending} onClick={() => start.mutate()} data-testid="start-review">
                      Prendre en charge l’examen
                    </Button>
                  ) : null}
                  <Button onClick={() => openDialog('approved')} icon={<CheckCircle2 className="h-4 w-4" />} data-testid="approve">
                    Approuver {subjectWord}
                  </Button>
                  <Button variant="secondary" onClick={() => openDialog('more_info_requested')} icon={<CircleAlert className="h-4 w-4" />} data-testid="request-more">
                    Demander un complément
                  </Button>
                  <Button variant="secondary" className="!text-danger" onClick={() => openDialog('rejected')} icon={<XCircle className="h-4 w-4" />} data-testid="reject">
                    Refuser avec un motif
                  </Button>
                </div>
              ) : (
                <p className="text-[14px] text-muted">{canDecide ? 'Ce dossier n’attend pas de décision.' : 'Décision réservée aux rôles habilités.'}</p>
              )}
              <p className="mt-4 text-[12px] text-muted">La décision est inscrite au journal d’audit. Elle ne valide pas automatiquement {c.subject === 'vehicle' ? 'l’identité de la chauffeuse' : 'un véhicule lié'}.</p>
            </Card>
            {related.length ? (
              <Card title="Dossiers liés" subtitle="Approuvés indépendamment">
                <ul className="flex flex-col gap-2">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link to={`/verifications/${r.id}`} className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 hover:bg-selected">
                        <span className="text-[14px] font-semibold">{SUBJECT_LABELS[r.subject]} · {r.id}</span>
                        <VerificationBadge status={r.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            <Card title="Profil">
              <DefinitionList items={[{ term: 'Compte', value: <Link className="font-semibold text-accent" to={`/personnes/${user.id}`}>{user.id}</Link> }, { term: 'Rôle', value: user.role === 'driver' ? 'Chauffeuse' : 'Passagère' }, ...(vehicle ? [{ term: 'Véhicule', value: `${vehicle.plate}` }] : [])]} />
            </Card>
            <Card title="Journal">{audit.length ? <AuditList events={audit} compact /> : <p className="text-[14px] text-muted">Aucun événement.</p>}</Card>
          </div>
        </div>
      </div>

      <DocViewer open={!!viewer} uploadId={viewer?.id} label={viewer?.label ?? ''} onClose={() => setViewer(null)} />

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        busy={decide.isPending}
        testId="decision-dialog"
        title={dialog === 'approved' ? `Approuver ${subjectWord} ?` : dialog === 'rejected' ? 'Refuser le dossier ?' : 'Demander un complément ?'}
        description={dialog === 'approved' ? `${who} sera informée. ${c.subject === 'vehicle' ? 'Le véhicule pourra recevoir des courses si l’identité est aussi approuvée.' : 'Le compte pourra être utilisé.'}` : 'Le message sera affiché à la personne avec l’action à faire.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={decide.isPending}>Annuler</Button>
            <Button
              variant={dialog === 'rejected' ? 'danger' : 'primary'}
              loading={decide.isPending}
              data-testid="confirm-decision"
              onClick={() => {
                const err = validate();
                setFormError(err);
                if (!err) decide.mutate();
              }}
            >
              {dialog === 'approved' ? 'Confirmer l’approbation' : dialog === 'rejected' ? 'Confirmer le refus' : 'Envoyer la demande'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {dialog === 'rejected' ? (
            <Field label="Motif du refus">
              {(fid) => (
                <Select id={fid} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} data-testid="reason-code">
                  <option value="">Choisir un motif</option>
                  {rejectionReasons.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </Select>
              )}
            </Field>
          ) : null}
          {dialog === 'more_info_requested' ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="label mb-1">Pièces à corriger</legend>
              {keys.map((key) => {
                const on = corrections[key] !== undefined;
                return (
                  <div key={key} className="rounded-2xl border border-line p-3">
                    <label className="flex items-center gap-2 text-[14px] font-medium">
                      <input type="checkbox" className="h-4 w-4 accent-[#6B3657]" checked={on} onChange={(e) => setCorrections((m) => ({ ...m, [key]: e.target.checked ? '' : undefined }))} data-testid={`correct-${key}`} />
                      {ITEM_LABELS[key]}
                    </label>
                    {on ? <Textarea aria-label={`Consigne pour ${ITEM_LABELS[key]}`} className="mt-2 min-h-[64px]" placeholder="Ex. : reprenez la photo sans reflet" value={corrections[key]} onChange={(e) => setCorrections((m) => ({ ...m, [key]: e.target.value }))} data-testid={`note-${key}`} /> : null}
                  </div>
                );
              })}
            </fieldset>
          ) : null}
          <Field label={dialog === 'approved' ? 'Note interne (facultative)' : 'Message à la personne'} hint={dialog === 'approved' ? undefined : '10 caractères minimum, sans jargon.'}>
            {(fid, d) => <Textarea id={fid} aria-describedby={d} value={message} onChange={(e) => setMessage(e.target.value)} data-testid="decision-message" />}
          </Field>
          {formError ? <Banner tone="danger" title={formError} /> : null}
        </div>
      </Dialog>
    </>
  );
}
