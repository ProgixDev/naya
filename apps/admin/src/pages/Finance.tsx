import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { errorMessage, newIdempotencyKey } from '@naya/api';
import type { LedgerEntry, Payment, Recharge, User, Wallet, Withdrawal } from '@naya/domain';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/context';
import { fmtDateTime, money, signed, toCentimes } from '../lib/format';
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, ErrorState, Field, Input, Kpi, PageHeader, Pagination, Segmented, Select, Skeleton, TableSkeleton, Textarea, toast } from '../components/ui';
import { LEDGER_LABELS, METHOD_LABELS, PaymentBadge, TransferBadge } from '../components/status';
import { ReasonField, UnitInput } from '../components/form';

type Tab = 'wallets' | 'transfers' | 'transactions' | 'payments' | 'commissions' | 'passengers' | 'ledger';
type DriverRow = { driver: User; wallet: Wallet };

/** A09 · Finance : portefeuilles, opérations, paiements, grand livre et corrections exceptionnelles. */
export function FinancePage() {
  const { cityId } = useWorkspace();
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('wallets');
  const [correctionFor, setCorrectionFor] = useState<DriverRow | null | 'pick'>(null);
  const q = useQuery({ queryKey: ['admin', 'finance', cityId], queryFn: () => api.admin.financeSummary(cityId), refetchInterval: 8000 });
  const d = q.data;
  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Solde comptable, fonds réservés, disponible au retrait, dette et espèces physiques restent distincts. Aucun paiement en attente ne crée de fonds."
        actions={can('finance.correct') ? <Button variant="secondary" icon={<Wrench className="h-4 w-4" />} onClick={() => setCorrectionFor('pick')} data-testid="new-correction">Correction exceptionnelle</Button> : null}
      />
      {q.isError ? (
        <Card><ErrorState onRetry={() => q.refetch()} /></Card>
      ) : (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="grid grid-cols-2 gap-6 xl:grid-cols-5">
              {d ? (
                <>
                  <Kpi label="Soldes comptables cumulés" value={money(d.totals.balances)} hint={`${d.drivers.length} chauffeuse(s)`} />
                  <Kpi label="Réservé (retraits en cours)" value={money(d.totals.reserved)} hint={`${d.withdrawals.filter((w) => w.status === 'pending').length} retrait(s) en attente`} />
                  <Kpi label="Dette de commission" value={money(d.totals.debt)} tone={d.totals.debt > 0 ? 'warning' : undefined} hint="Courses en espèces non compensées" />
                  <Kpi label="Offres bloquées (plafond)" value={d.totals.blocked} tone={d.totals.blocked ? 'danger' : undefined} hint={`${d.failedPayments.length} paiement(s) échoué(s)`} />
                  <Kpi label="Commissions Naya" value={money(d.commissions.total)} hint={`sur ${money(d.commissions.gross)} de courses terminées`} />
                </>
              ) : (
                Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)
              )}
            </div>
          </Card>
          <Segmented<Tab> label="Section" value={tab} onChange={setTab} options={[{ value: 'wallets', label: 'Portefeuilles chauffeuses' }, { value: 'passengers', label: 'Portefeuilles clientes' }, { value: 'transfers', label: 'Recharges et retraits' }, { value: 'transactions', label: 'Transactions' }, { value: 'payments', label: 'Échecs et en attente' }, { value: 'commissions', label: 'Commissions' }, { value: 'ledger', label: 'Grand livre' }]} />
          <Card padded={false}>
            {!d && tab !== 'ledger' ? <TableSkeleton cols={6} /> : null}
            {d && tab === 'wallets' ? (
              <DataTable<DriverRow>
                caption="Portefeuilles"
                rows={d.drivers}
                rowKey={(r) => r.driver.id}
                initialSort={{ key: 'bal', dir: 'asc' }}
                empty={<EmptyState title="Aucune chauffeuse dans cette ville" />}
                columns={[
                  { key: 'who', header: 'Chauffeuse', render: (r) => <Link className="font-semibold hover:text-accent" to={`/personnes/${r.driver.id}`} onClick={(e) => e.stopPropagation()}>{r.driver.firstName} {r.driver.lastName}</Link>, sort: (r) => r.driver.lastName },
                  { key: 'bal', header: 'Solde comptable', align: 'right', render: (r) => <span className={r.wallet.balance < 0 ? 'text-danger' : ''}>{money(r.wallet.balance)}</span>, sort: (r) => r.wallet.balance },
                  { key: 'res', header: 'Réservé', align: 'right', render: (r) => money(r.wallet.reserved), sort: (r) => r.wallet.reserved },
                  { key: 'av', header: 'Disponible', align: 'right', render: (r) => money(r.wallet.available), sort: (r) => r.wallet.available },
                  { key: 'debt', header: 'Dette / plafond', align: 'right', render: (r) => `${money(r.wallet.debt)} / ${money(r.wallet.debtLimit)}`, sort: (r) => r.wallet.debt },
                  { key: 'st', header: 'Offres', render: (r) => (r.wallet.offersBlockedByDebt ? <Badge tone="danger">Bloquées</Badge> : <Badge tone="success">Autorisées</Badge>) },
                  ...(can('finance.correct') ? [{ key: 'act', header: '', align: 'right' as const, render: (r: DriverRow) => <Button size="sm" variant="ghost" onClick={() => setCorrectionFor(r)} data-testid={`correct-${r.driver.id}`}>Corriger</Button> }] : []),
                ]}
              />
            ) : null}
            {d && tab === 'transfers' ? <Transfers recharges={d.recharges} withdrawals={d.withdrawals} names={Object.fromEntries(d.drivers.map((r) => [r.driver.id, `${r.driver.firstName} ${r.driver.lastName}`]))} /> : null}
            {d && tab === 'transactions' ? <Transactions payments={d.payments} /> : null}
            {d && tab === 'payments' ? <PaymentsToWatch failed={d.failedPayments} pending={d.pendingPayments} /> : null}
            {d && tab === 'commissions' ? <Commissions data={d.commissions} /> : null}
            {d && tab === 'passengers' ? <PassengerWallets rows={d.passengerWallets} /> : null}
            {tab === 'ledger' ? <Ledger cityId={cityId} drivers={d?.drivers ?? []} /> : null}
          </Card>
        </div>
      )}
      {correctionFor ? <CorrectionDialog drivers={d?.drivers ?? []} initial={correctionFor === 'pick' ? null : correctionFor} onClose={() => setCorrectionFor(null)} /> : null}
    </>
  );
}

function Transactions({ payments }: { payments: Payment[] }) {
  const [status, setStatus] = useState<'' | Payment['status']>('');
  const rows = payments.filter((p) => !status || p.status === status);
  return (
    <>
      <div className="px-5 pt-5">
        <Segmented label="Statut" value={status} onChange={setStatus} options={[{ value: '', label: 'Toutes' }, { value: 'confirmed', label: 'Confirmées' }, { value: 'pending', label: 'En attente' }, { value: 'failed', label: 'Échouées' }]} />
      </div>
      <div className="mt-4">
        <DataTable
          caption="Transactions"
          rows={rows}
          rowKey={(p) => p.id}
          empty={<EmptyState title="Aucune transaction" />}
          columns={[
            { key: 'id', header: 'Paiement', render: (p) => <span className="font-semibold">{p.id}</span> },
            { key: 'r', header: 'Course', render: (p) => (p.rideId ? <Link className="text-accent" to={`/courses/${p.rideId}`}>{p.rideId}</Link> : '—') },
            { key: 'm', header: 'Moyen', render: (p) => `${METHOD_LABELS[p.method]} · ${p.purpose === 'ride' ? 'course' : 'frais d’annulation'}` },
            { key: 'pr', header: 'Prestataire', render: (p) => <div><div>{p.provider}</div>{p.providerRef ? <div className="text-[12px] text-muted">{p.providerRef}</div> : null}</div> },
            { key: 'at', header: 'Date', render: (p) => fmtDateTime(p.createdAt), sort: (p) => p.createdAt },
            { key: 's', header: 'Statut', render: (p) => <div className="flex flex-col items-start gap-1"><PaymentBadge status={p.status} />{p.failureReason ? <span className="text-[12px] text-muted">{p.failureReason}</span> : null}</div> },
            { key: 'a', header: 'Montant', align: 'right', render: (p) => money(p.amount), sort: (p) => p.amount },
          ]}
        />
      </div>
    </>
  );
}

type CommissionData = { total: number; gross: number; byService: { id: string; name: string; rides: number; gross: number; commission: number }[] };
function Commissions({ data }: { data: CommissionData }) {
  return (
    <div className="pt-2">
      <p className="px-5 py-3 text-[13px] text-muted">Commission calculée sur le prix et le taux figés à la réservation de chaque course terminée. Les espèces créent une dette de commission ; la carte et le portefeuille la prélèvent directement.</p>
      <DataTable
        caption="Commissions par type de véhicule"
        rows={data.byService}
        rowKey={(r) => r.id}
        empty={<EmptyState title="Aucune course terminée" />}
        columns={[
          { key: 'n', header: 'Service', render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: 'r', header: 'Courses', align: 'right', render: (r) => r.rides, sort: (r) => r.rides },
          { key: 'g', header: 'Volume', align: 'right', render: (r) => money(r.gross), sort: (r) => r.gross },
          { key: 'c', header: 'Commission', align: 'right', render: (r) => <span className="font-semibold">{money(r.commission)}</span>, sort: (r) => r.commission },
          { key: 'p', header: 'Taux moyen', align: 'right', render: (r) => (r.gross ? `${((r.commission / r.gross) * 100).toFixed(1).replace('.', ',')} %` : '—') },
        ]}
      />
    </div>
  );
}

type PassengerWalletRow = { passenger: { id: string; name: string }; wallet: { balance: number; reserved: number; entries: { id: string; amount: number; label: string; status: 'pending' | 'confirmed' | 'failed'; at: string; rideId: string | null }[] } };
const ENTRY_STATUS = { pending: 'En attente', confirmed: 'Confirmée', failed: 'Échouée' } as const;
function PassengerWallets({ rows }: { rows: PassengerWalletRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="pt-2">
      <p className="px-5 py-3 text-[13px] text-muted">Portefeuilles prépayés des clientes : recharges, débits de courses et fonds réservés pendant une course.</p>
      <DataTable<PassengerWalletRow>
        caption="Portefeuilles clientes"
        rows={rows}
        rowKey={(r) => r.passenger.id}
        onRowClick={(r) => setOpen(open === r.passenger.id ? null : r.passenger.id)}
        empty={<EmptyState title="Aucun portefeuille cliente" message="Les portefeuilles apparaissent après une première recharge." />}
        columns={[
          { key: 'n', header: 'Cliente', render: (r) => <Link className="font-semibold hover:text-accent" to={`/personnes/${r.passenger.id}`} onClick={(e) => e.stopPropagation()}>{r.passenger.name}</Link> },
          { key: 'b', header: 'Solde', align: 'right', render: (r) => money(r.wallet.balance), sort: (r) => r.wallet.balance },
          { key: 'r', header: 'Réservé', align: 'right', render: (r) => money(r.wallet.reserved) },
          { key: 'f', header: 'Échecs', align: 'right', render: (r) => r.wallet.entries.filter((e) => e.status === 'failed').length },
          { key: 'e', header: 'Mouvements', align: 'right', render: (r) => r.wallet.entries.length },
        ]}
      />
      {rows.filter((r) => r.passenger.id === open).map((r) => (
        <div key={r.passenger.id} className="border-t border-line px-5 py-4">
          <h3 className="font-semibold">Historique · {r.passenger.name}</h3>
          <ul className="mt-2 flex flex-col gap-1 text-[13px]">
            {r.wallet.entries.slice().reverse().map((e) => (
              <li key={e.id} className="flex justify-between gap-4">
                <span>{fmtDateTime(e.at)} · {e.label}{e.rideId ? ` · ${e.rideId}` : ''} · <span className={e.status === 'failed' ? 'text-danger' : 'text-muted'}>{ENTRY_STATUS[e.status]}</span></span>
                <span className="tabular">{signed(e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Transfers({ recharges, withdrawals, names }: { recharges: Recharge[]; withdrawals: Withdrawal[]; names: Record<string, string> }) {
  const rows = [...recharges.map((r) => ({ kind: 'Recharge' as const, id: r.id, driverId: r.driverId, amount: r.amount, via: r.providerName, status: r.status, at: r.createdAt, reason: r.failureReason })), ...withdrawals.map((w) => ({ kind: 'Retrait' as const, id: w.id, driverId: w.driverId, amount: w.amount, via: w.destinationLabel, status: w.status, at: w.createdAt, reason: w.failureReason }))].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="pt-2">
      <p className="px-5 py-3 text-[13px] text-muted">Les retraits ne nécessitent pas d’approbation : le prestataire confirme ou refuse. Un retrait en cours réserve les fonds ; un échec libère la réservation sans crédit artificiel.</p>
      <DataTable
        caption="Recharges et retraits"
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title="Aucune opération" />}
        columns={[
          { key: 'id', header: 'Opération', render: (r) => <span className="font-semibold">{r.id}</span> },
          { key: 'k', header: 'Type', render: (r) => r.kind },
          { key: 'd', header: 'Chauffeuse', render: (r) => names[r.driverId] ?? r.driverId },
          { key: 'v', header: 'Via', render: (r) => r.via },
          { key: 'at', header: 'Date', render: (r) => fmtDateTime(r.at), sort: (r) => r.at },
          { key: 's', header: 'Statut', render: (r) => <div className="flex flex-col items-start gap-1"><TransferBadge status={r.status} />{r.reason ? <span className="text-[12px] text-muted">{r.reason}</span> : null}</div> },
          { key: 'a', header: 'Montant', align: 'right', render: (r) => money(r.amount), sort: (r) => r.amount },
        ]}
      />
    </div>
  );
}

function PaymentsToWatch({ failed, pending }: { failed: Payment[]; pending: Payment[] }) {
  const rows = [...failed, ...pending].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <DataTable
      caption="Paiements échoués ou en attente"
      rows={rows}
      rowKey={(p) => p.id}
      empty={<EmptyState title="Aucun paiement à suivre" message="Tous les paiements sont confirmés." />}
      columns={[
        { key: 'id', header: 'Paiement', render: (p) => <span className="font-semibold">{p.id}</span> },
        { key: 'r', header: 'Course', render: (p) => (p.rideId ? <Link className="text-accent" to={`/courses/${p.rideId}`}>{p.rideId}</Link> : '—') },
        { key: 'm', header: 'Moyen', render: (p) => `${METHOD_LABELS[p.method]} · ${p.purpose === 'ride' ? 'course' : 'frais d’annulation'}` },
        { key: 'at', header: 'Mise à jour', render: (p) => fmtDateTime(p.updatedAt) },
        { key: 's', header: 'Statut', render: (p) => <div className="flex flex-col items-start gap-1"><PaymentBadge status={p.status} />{p.failureReason ? <span className="text-[12px] text-muted">{p.failureReason}</span> : null}</div> },
        { key: 'a', header: 'Montant', align: 'right', render: (p) => money(p.amount) },
      ]}
    />
  );
}

function Ledger({ cityId, drivers }: { cityId: string; drivers: DriverRow[] }) {
  const [driverId, setDriverId] = useState('');
  const [type, setType] = useState('');
  const [cursor, setCursor] = useState(0);
  const q = useQuery({ queryKey: ['admin', 'ledger', cityId, driverId, type, cursor], queryFn: () => api.admin.ledger({ cityId, driverId: driverId || undefined, type: type || undefined, cursor, limit: 25 }) });
  return (
    <>
      <div className="flex flex-wrap gap-2 px-5 pt-5">
        <Select aria-label="Chauffeuse" value={driverId} onChange={(e) => (setDriverId(e.target.value), setCursor(0))} className="w-56">
          <option value="">Toutes les chauffeuses</option>
          {drivers.map((d) => <option key={d.driver.id} value={d.driver.id}>{d.driver.firstName} {d.driver.lastName}</option>)}
        </Select>
        <Select aria-label="Type de mouvement" value={type} onChange={(e) => (setType(e.target.value), setCursor(0))} className="w-56">
          <option value="">Tous les mouvements</option>
          {Object.entries(LEDGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <div className="mt-4">
        {q.isLoading ? <TableSkeleton cols={6} /> : null}
        {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : null}
        {q.data ? (
          <>
            <DataTable<{ entry: LedgerEntry; driverName: string }>
              caption="Grand livre"
              rows={q.data.items}
              rowKey={(r) => r.entry.id}
              empty={<EmptyState title="Aucun mouvement" />}
              columns={[
                { key: 'at', header: 'Date', render: (r) => fmtDateTime(r.entry.createdAt) },
                { key: 'who', header: 'Chauffeuse', render: (r) => r.driverName },
                { key: 't', header: 'Mouvement', render: (r) => <div><div>{LEDGER_LABELS[r.entry.type]}</div><div className="line-clamp-1 text-[12px] text-muted">{r.entry.description}</div></div> },
                { key: 'ref', header: 'Réf.', render: (r) => r.entry.rideId ?? r.entry.rechargeId ?? r.entry.withdrawalId ?? r.entry.correctionId ?? '—' },
                { key: 'a', header: 'Montant', align: 'right', render: (r) => <span className={r.entry.amount > 0 ? 'text-success' : ''}>{signed(r.entry.amount)}</span> },
                { key: 'b', header: 'Solde après', align: 'right', render: (r) => money(r.entry.balanceAfter) },
              ]}
            />
            <Pagination cursor={cursor} total={q.data.total} limit={25} onChange={setCursor} />
          </>
        ) : null}
      </div>
    </>
  );
}

/** Exceptional correction: explicit permission, reason, confirmation step and an idempotency key per intent. */
function CorrectionDialog({ drivers, initial, onClose }: { drivers: DriverRow[]; initial: DriverRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const key = useMemo(() => newIdempotencyKey(), []);
  const [driverId, setDriverId] = useState(initial?.driver.id ?? '');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const row = drivers.find((d) => d.driver.id === driverId);
  const cents = toCentimes(amountText);
  const signedAmount = cents === null ? null : direction === 'credit' ? Math.abs(cents) : -Math.abs(cents);
  const m = useMutation({
    mutationFn: () => api.admin.correction({ driverId, amount: signedAmount!, reason: reason.trim(), relatedEntityId: null }, key),
    onSuccess: (e) => {
      toast(`Correction enregistrée · nouveau solde ${money(e.balanceAfter)}`, 'success');
      qc.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
    onError: (e) => setErrors({ server: errorMessage(e) }),
  });
  const next = () => {
    const e: Record<string, string> = {};
    if (!row) e.driver = 'Choisissez une chauffeuse.';
    if (!cents || cents <= 0) e.amount = 'Montant positif en MAD, ex. 25 ou 12,50.';
    if (reason.trim().length < 10) e.reason = 'Motif requis (10 caractères minimum).';
    setErrors(e);
    if (!Object.keys(e).length) setStep('confirm');
  };
  return (
    <Dialog
      open
      onClose={onClose}
      busy={m.isPending}
      testId="correction-dialog"
      tone={step === 'confirm' ? (direction === 'debit' ? 'danger' : 'success') : 'warning'}
      icon={<Wrench />}
      title={step === 'form' ? 'Correction exceptionnelle' : 'Confirmer la correction ?'}
      description={step === 'form' ? 'Réservée aux régularisations justifiées. Elle crée un mouvement au grand livre et un événement d’audit avec votre motif.' : undefined}
      footer={
        step === 'form' ? (
          <>
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button onClick={next} data-testid="correction-next">Vérifier</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep('form')} disabled={m.isPending}>Modifier</Button>
            <Button loading={m.isPending} onClick={() => m.mutate()} data-testid="correction-confirm">Enregistrer la correction</Button>
          </>
        )
      }
    >
      {step === 'form' ? (
        <div className="flex flex-col gap-4">
          <Field label="Chauffeuse" error={errors.driver}>
            {(fid) => (
              <Select id={fid} value={driverId} onChange={(e) => setDriverId(e.target.value)} data-testid="correction-driver">
                <option value="">Choisir</option>
                {drivers.map((d) => <option key={d.driver.id} value={d.driver.id}>{d.driver.firstName} {d.driver.lastName} · solde {money(d.wallet.balance)}</option>)}
              </Select>
            )}
          </Field>
          <Segmented label="Sens" value={direction} onChange={setDirection} options={[{ value: 'credit', label: 'Crédit' }, { value: 'debit', label: 'Débit' }]} />
          <Field label="Montant" error={errors.amount}>
            {(fid, d) => <UnitInput id={fid} aria-describedby={d} unit="MAD" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="25,00" data-testid="correction-amount" />}
          </Field>
          <ReasonField value={reason} onChange={setReason} error={errors.reason} placeholder="Ex. : remboursement d’un péage justifié par ticket." testId="correction-reason" />
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-[14px]">
          <div className="rounded-2xl bg-background p-4">
            <div>{row?.driver.firstName} {row?.driver.lastName}</div>
            <div className="mt-2 flex justify-between"><span className="text-muted">Solde actuel</span><span className="tabular">{money(row!.wallet.balance)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Correction</span><span className="tabular font-semibold">{signed(signedAmount!)}</span></div>
            <div className="flex justify-between border-t border-line pt-2 mt-2"><span className="text-muted">Solde après</span><span className="tabular font-semibold">{money(row!.wallet.balance + signedAmount!)}</span></div>
          </div>
          <p className="text-muted">Motif : {reason}</p>
          {errors.server ? <Banner tone="danger" title={errors.server} /> : null}
        </div>
      )}
    </Dialog>
  );
}
