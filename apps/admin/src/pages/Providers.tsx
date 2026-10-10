import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, type PaymentAdapterInfo } from '@naya/api';
import { formatMoney, type PaymentProviderConfig, type ProviderOption } from '@naya/domain';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/context';
import { toCentimes } from '../lib/format';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Skeleton, Textarea, toast } from '../components/ui';
import { ChoiceCards, ChoiceChips, FormSection, ImpactList, ReasonField, UnitInput } from '../components/form';
import { CreditCard, Power } from 'lucide-react';

type Row = ProviderOption & { adapterName: string };

const PURPOSES: { key: PaymentProviderConfig['purpose']; title: string; subtitle: string }[] = [
  { key: 'ride', title: 'Paiement des courses', subtitle: 'Moyens proposés aux passagères au moment du devis.' },
  { key: 'recharge', title: 'Recharge du portefeuille', subtitle: 'Carte, wallet marocain, paiement mobile, agences. Seule une confirmation du prestataire crédite le portefeuille.' },
  { key: 'withdrawal', title: 'Retraits', subtitle: 'Virements vers le compte des chauffeuses, sans approbation manuelle.' },
];
const KIND = { cash: 'Espèces', card: 'Carte bancaire', bank_transfer: 'Virement', cash_network: 'Réseau d’agences', mobile_wallet: 'Wallet marocain', mobile_payment: 'Paiement mobile' } as const;
const FLOW = { hosted_page: 'Page sécurisée', wallet_approval: 'Validation dans l’app wallet', voucher: 'Code au guichet', bank_transfer: 'Virement', cash: 'Remise en main propre' } as const;
const AUDIENCE = (p: Row) => (p.purpose !== 'recharge' ? null : !p.audiences?.length || p.audiences.length === 2 ? 'Clientes et chauffeuses' : p.audiences[0] === 'driver' ? 'Chauffeuses uniquement' : 'Clientes uniquement');

/** A12 · Prestataires de paiement par ville et par usage, chacun branché sur un adaptateur interchangeable. */
export function ProvidersPage() {
  const { cityId } = useWorkspace();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['admin', 'providers', cityId], queryFn: () => api.admin.providers(cityId) });
  const adapters = useQuery({ queryKey: ['admin', 'payment-adapters'], queryFn: api.admin.paymentAdapters });
  const [toggle, setToggle] = useState<Row | null>(null);
  const [edit, setEdit] = useState<{ purpose: PaymentProviderConfig['purpose']; row: Row | null } | null>(null);
  const editable = can('config.edit');
  return (
    <>
      <PageHeader title="Prestataires de paiement" subtitle="Par ville et par usage. Les applications n’affichent que les moyens activés et configurés." />
      <div className="mb-5 flex flex-col gap-3">
        <Banner tone="info" title="Architecture modulaire">
          Chaque moyen de paiement est branché sur un adaptateur (carte, wallet marocain, paiement mobile, réseau d’agences, virement). Changer d’adaptateur remplace le prestataire sans toucher au portefeuille, au grand livre ni aux rappels signés.
        </Banner>
        <Banner tone="warning" title="Environnement de démonstration">Les adaptateurs « bac à sable » sont simulés. Les emplacements « production » attendent les identifiants du prestataire côté serveur.</Banner>
      </div>
      {q.isLoading ? <Skeleton className="h-[360px] w-full" /> : null}
      {q.isError ? <Card><ErrorState onRetry={() => q.refetch()} /></Card> : null}
      <div className="flex flex-col gap-5">
        {q.data
          ? PURPOSES.map((p) => {
              const list = q.data.filter((x) => x.purpose === p.key);
              return (
                <Card key={p.key} title={p.title} subtitle={p.subtitle} padded={false} action={editable ? <Button size="sm" variant="secondary" onClick={() => setEdit({ purpose: p.key, row: null })} data-testid={`add-provider-${p.key}`}>Ajouter un prestataire</Button> : undefined}>
                  {list.length === 0 ? (
                    <EmptyState title="Aucun prestataire" message="Aucun moyen n’est configuré pour cet usage dans cette ville." />
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {list.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-center gap-4 px-6 py-4" data-testid={`provider-${x.id}`}>
                          <div className="min-w-[260px] flex-1">
                            <div className="text-[15px] font-semibold">{x.name}</div>
                            <div className="text-[13px] text-muted">
                              {KIND[x.kind]} · {FLOW[x.flow]} · adaptateur {x.adapterName}
                            </div>
                            <div className="text-[12px] text-muted">
                              {[AUDIENCE(x), x.minAmount ? `min ${formatMoney(x.minAmount)}` : null, x.maxAmount ? `max ${formatMoney(x.maxAmount)}` : null, x.needsPhone ? 'numéro de téléphone demandé' : null].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <Badge tone={x.mode === 'live' ? 'info' : 'accent'} dot={false}>{x.mode === 'live' ? 'Production' : 'Démo'}</Badge>
                          {x.configured ? <Badge tone="success">Configuré</Badge> : <Badge tone="warning">Identifiants manquants</Badge>}
                          <Badge tone={x.enabled ? 'success' : 'neutral'}>{x.enabled ? 'Activé' : 'Désactivé'}</Badge>
                          {editable ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setEdit({ purpose: x.purpose, row: x })} data-testid={`settings-${x.id}`}>Réglages</Button>
                              <Button size="sm" variant={x.enabled ? 'ghost' : 'secondary'} disabled={!x.configured && !x.enabled} title={!x.configured ? 'Configurez les identifiants du prestataire avant de l’activer.' : undefined} onClick={() => setToggle(x)} data-testid={`toggle-${x.id}`}>
                                {x.enabled ? 'Désactiver' : 'Activer'}
                              </Button>
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })
          : null}
      </div>
      {toggle ? <ToggleDialog provider={toggle} onClose={() => setToggle(null)} /> : null}
      {edit && adapters.data ? <SettingsDialog cityId={cityId} purpose={edit.purpose} row={edit.row} adapters={adapters.data} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function SettingsDialog({ cityId, purpose, row, adapters, onClose }: { cityId: string; purpose: PaymentProviderConfig['purpose']; row: Row | null; adapters: PaymentAdapterInfo[]; onClose: () => void }) {
  const qc = useQueryClient();
  const usable = adapters.filter((a) => a.purposes.includes(purpose) && a.id !== 'cash');
  const [adapter, setAdapter] = useState(row?.adapter ?? usable[0]?.id ?? '');
  const [name, setName] = useState(row?.name ?? '');
  const [audience, setAudience] = useState<'both' | 'passenger' | 'driver'>(!row?.audiences?.length || row.audiences.length === 2 ? 'both' : row.audiences[0]!);
  const [min, setMin] = useState(row?.minAmount ? String(row.minAmount / 100) : '');
  const [max, setMax] = useState(row?.maxAmount ? String(row.maxAmount / 100) : '');
  const [instructions, setInstructions] = useState(row?.instructions ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const chosen = adapters.find((a) => a.id === adapter);
  const swapped = !!row && row.adapter !== adapter;
  const settings = () => ({
    name: name.trim(),
    adapter,
    audiences: purpose !== 'recharge' || audience === 'both' ? [] : [audience],
    minAmount: min.trim() ? toCentimes(min) : null,
    maxAmount: max.trim() ? toCentimes(max) : null,
    instructions: instructions.trim() || null,
    reason: reason.trim(),
  });
  const m = useMutation({
    mutationFn: () => (row ? api.admin.updateProvider(row.id, settings()) : api.admin.createProvider({ ...settings(), cityId, purpose })),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['admin'] }), toast(row ? 'Prestataire mis à jour' : 'Prestataire ajouté (désactivé)', 'success'), onClose()),
    onError: (e) => setError(errorMessage(e)),
  });
  const submit = () => {
    if (name.trim().length < 2) return setError('Donnez un nom affiché aux personnes.');
    if (reason.trim().length < 10) return setError('Motif requis (10 caractères minimum).');
    setError(null);
    m.mutate();
  };
  return (
    <Dialog
      open
      size="lg"
      icon={<CreditCard />}
      onClose={onClose}
      busy={m.isPending}
      testId="provider-settings"
      title={row ? `Réglages · ${row.name}` : `Ajouter un prestataire · ${PURPOSES.find((x) => x.key === purpose)?.title}`}
      description={row ? 'Les opérations en cours gardent leur référence et se terminent normalement.' : 'Le prestataire est créé désactivé : activez-le une fois testé.'}
      footer={<><Button variant="ghost" onClick={onClose} disabled={m.isPending}>Annuler</Button><Button loading={m.isPending} onClick={submit} data-testid="save-provider">{row ? 'Enregistrer' : 'Ajouter le prestataire'}</Button></>}
    >
      <div className="flex flex-col gap-6 pb-2">
        {error ? <Banner tone="danger" title={error} /> : null}
        <FormSection title="Adaptateur" hint="L’implémentation qui parle au prestataire. En changer remplace le prestataire sans toucher au portefeuille ni au grand livre.">
          <ChoiceCards
            label="Adaptateur"
            value={adapter}
            onChange={setAdapter}
            columns={2}
            testIdPrefix="adapter"
            options={usable.map((a) => ({ value: a.id, label: a.name, hint: a.configured ? a.description : 'Identifiants manquants côté serveur : à configurer avant activation.' }))}
          />
          {swapped ? <Banner tone="warning" title="Changement de prestataire">{chosen?.configured ? 'Les nouvelles opérations passeront par ce prestataire.' : 'Ce prestataire n’a pas d’identifiants : le moyen sera désactivé jusqu’à leur ajout.'}</Banner> : null}
        </FormSection>
        <FormSection title="Affichage">
          <Field label="Nom affiché aux personnes">{(f) => <Input id={f} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Wallet marocain" data-testid="provider-name" />}</Field>
          {purpose === 'recharge' ? (
            <div>
              <p className="label mb-2">Proposé à</p>
              <ChoiceChips<'both' | 'passenger' | 'driver'> label="Proposé à" value={audience} onChange={setAudience} options={[{ value: 'both', label: 'Clientes et chauffeuses' }, { value: 'passenger', label: 'Clientes uniquement' }, { value: 'driver', label: 'Chauffeuses uniquement' }]} />
            </div>
          ) : null}
          <Field label="Consignes (facultatif)" hint="Sinon, les consignes par défaut de l’adaptateur.">{(f) => <Textarea id={f} value={instructions} onChange={(e) => setInstructions(e.target.value)} />}</Field>
        </FormSection>
        <FormSection title="Montants" hint="Laisser vide pour ne pas limiter.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum">{(f) => <UnitInput id={f} unit="MAD" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Aucun" />}</Field>
            <Field label="Maximum">{(f) => <UnitInput id={f} unit="MAD" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Aucun" />}</Field>
          </div>
        </FormSection>
        <ReasonField value={reason} onChange={setReason} testId="provider-settings-reason" />
      </div>
    </Dialog>
  );
}

function ToggleDialog({ provider, onClose }: { provider: Row; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const enable = !provider.enabled;
  const m = useMutation({
    mutationFn: () => api.admin.toggleProvider(provider.id, { enabled: enable, reason: reason.trim() }),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['admin'] }), toast(enable ? 'Prestataire activé' : 'Prestataire désactivé', 'success'), onClose()),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  return (
    <Dialog
      open
      size="sm"
      tone={enable ? 'success' : 'danger'}
      icon={<Power />}
      onClose={onClose}
      busy={m.isPending}
      title={`${enable ? 'Activer' : 'Désactiver'} ${provider.name} ?`}
      description={`${KIND[provider.kind]} · ${PURPOSES.find((x) => x.key === provider.purpose)?.title}`}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant={enable ? 'primary' : 'danger'} disabled={reason.trim().length < 10} loading={m.isPending} onClick={() => m.mutate()} data-testid="confirm-provider">{enable ? 'Activer' : 'Désactiver'}</Button></>}
    >
      <div className="flex flex-col gap-4">
        <ImpactList tone={enable ? 'success' : 'danger'} items={enable ? ['Le moyen apparaît dans les applications de la ville.', 'Les nouvelles opérations peuvent l’utiliser.'] : ['Le moyen disparaît des nouveaux devis et opérations.', 'Les opérations en cours se poursuivent normalement.']} />
        <ReasonField value={reason} onChange={setReason} testId="provider-reason" />
      </div>
    </Dialog>
  );
}
