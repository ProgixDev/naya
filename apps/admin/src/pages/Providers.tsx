import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@naya/api';
import type { PaymentProviderConfig } from '@naya/domain';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useWorkspace } from '../lib/context';
import { Badge, Banner, Button, Card, Dialog, EmptyState, ErrorState, Field, PageHeader, Skeleton, Textarea, toast } from '../components/ui';

const PURPOSES: { key: PaymentProviderConfig['purpose']; title: string; subtitle: string }[] = [
  { key: 'ride', title: 'Paiement des courses', subtitle: 'Moyens proposés aux passagères au moment du devis.' },
  { key: 'recharge', title: 'Recharge du portefeuille', subtitle: 'Seule une confirmation du prestataire crédite le portefeuille.' },
  { key: 'withdrawal', title: 'Retraits', subtitle: 'Virements vers le compte des chauffeuses, sans approbation manuelle.' },
];
const KIND = { cash: 'Espèces', card: 'Carte bancaire', bank_transfer: 'Virement', cash_network: 'Réseau d’agences' } as const;

/** A12 · Prestataires de paiement par ville et par usage. */
export function ProvidersPage() {
  const { cityId } = useWorkspace();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['admin', 'providers', cityId], queryFn: () => api.admin.providers(cityId) });
  const [toggle, setToggle] = useState<PaymentProviderConfig | null>(null);
  const editable = can('config.edit');
  return (
    <>
      <PageHeader title="Prestataires de paiement" subtitle="Par ville et par usage. Les applications n’affichent que les moyens activés et configurés." />
      <div className="mb-5">
        <Banner tone="info" title="Environnement de démonstration">Les prestataires « démo » sont simulés par l’API de démonstration. Aucun prestataire réel n’est configuré : il faut des identifiants et des rappels signés côté serveur.</Banner>
      </div>
      {q.isLoading ? <Skeleton className="h-[360px] w-full" /> : null}
      {q.isError ? <Card><ErrorState onRetry={() => q.refetch()} /></Card> : null}
      <div className="flex flex-col gap-5">
        {q.data
          ? PURPOSES.map((p) => {
              const list = q.data.filter((x) => x.purpose === p.key);
              return (
                <Card key={p.key} title={p.title} subtitle={p.subtitle} padded={false}>
                  {list.length === 0 ? (
                    <EmptyState title="Aucun prestataire" message="Aucun moyen n’est configuré pour cet usage dans cette ville." />
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {list.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-center gap-4 px-6 py-4" data-testid={`provider-${x.id}`}>
                          <div className="min-w-[220px] flex-1">
                            <div className="text-[15px] font-semibold">{x.name}</div>
                            <div className="text-[13px] text-muted">{KIND[x.kind]} · {x.id}</div>
                          </div>
                          <Badge tone={x.mode === 'live' ? 'info' : 'accent'} dot={false}>{x.mode === 'live' ? 'Production' : 'Démo'}</Badge>
                          {x.configured ? <Badge tone="success">Configuré</Badge> : <Badge tone="warning">Identifiants manquants</Badge>}
                          <Badge tone={x.enabled ? 'success' : 'neutral'}>{x.enabled ? 'Activé' : 'Désactivé'}</Badge>
                          {editable ? (
                            <Button size="sm" variant={x.enabled ? 'ghost' : 'secondary'} disabled={!x.configured && !x.enabled} title={!x.configured ? 'Configurez les identifiants du prestataire avant de l’activer.' : undefined} onClick={() => setToggle(x)} data-testid={`toggle-${x.id}`}>
                              {x.enabled ? 'Désactiver' : 'Activer'}
                            </Button>
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
    </>
  );
}

function ToggleDialog({ provider, onClose }: { provider: PaymentProviderConfig; onClose: () => void }) {
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
      onClose={onClose}
      busy={m.isPending}
      title={`${enable ? 'Activer' : 'Désactiver'} ${provider.name} ?`}
      description={enable ? 'Le moyen apparaîtra dans les applications de la ville.' : 'Le moyen disparaîtra des nouveaux devis et opérations. Les opérations en cours se poursuivent.'}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant={enable ? 'primary' : 'danger'} disabled={reason.trim().length < 10} loading={m.isPending} onClick={() => m.mutate()} data-testid="confirm-provider">Confirmer</Button></>}
    >
      <Field label="Motif" hint="10 caractères minimum, inscrit au journal.">{(f, d) => <Textarea id={f} aria-describedby={d} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="provider-reason" />}</Field>
    </Dialog>
  );
}
