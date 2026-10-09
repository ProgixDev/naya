import { DomainError, type Centimes, type PaymentProviderConfig, type PaymentPurpose, type ProviderFlow, type ProviderKind, type ProviderOption } from '@naya/domain';
import type { ProviderJob, State } from '../state';
import { nextId } from '../store';

/**
 * Payment provider adapters.
 *
 * The finance core (ledger, wallets, idempotency, signed callbacks) never knows which
 * company processes a payment. It asks the provider's adapter to start an operation and
 * later receives a `ProviderCallback` (`confirmed` / `failed`) for the returned reference.
 * Integrating or replacing a provider (a card PSP, a Moroccan wallet, a cash network) means
 * writing one adapter and pointing a provider configuration at it from the back-office.
 */
export interface PaymentAdapter {
  id: string;
  name: string;
  description: string;
  mode: 'demo' | 'live';
  kinds: ProviderKind[];
  purposes: PaymentPurpose[];
  flow: ProviderFlow;
  /** The payer's phone number is sent to the provider (mobile wallet / mobile money). */
  needsPhone: boolean;
  /** Live adapters need credentials provisioned on the server. */
  configured: () => boolean;
  /** Starts an operation. Returns what the payer must do and how the demo resolves it. */
  initiate: (op: AdapterOperation) => AdapterResult;
}

export interface AdapterOperation {
  /** Ledger object the provider reference will be matched to. */
  kind: 'recharge' | 'passenger_recharge';
  id: string;
  amount: Centimes;
  payerPhone: string | null;
  provider: PaymentProviderConfig;
  nowMs: number;
}

export interface AdapterResult {
  providerRef: string;
  flow: ProviderFlow;
  instructions: string;
  voucherCode?: string;
  expiresAt?: string;
  /** Demo only: how the simulated provider will answer. `manual` waits for the sandbox screen. */
  job: Omit<ProviderJob, 'id' | 'delivered' | 'kind' | 'ref'>;
}

const VOUCHER_HOURS = 48;
const manual = { outcome: 'manual' as const, reason: null, dueAt: null };

/** Deterministic 8-digit code per operation, grouped for reading aloud at a counter. */
function voucher(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 100_000_000;
  const d = String(h).padStart(8, '0');
  return `${d.slice(0, 4)} ${d.slice(4)}`;
}

const notConfigured = (): never => {
  throw new DomainError('PAYMENT_METHOD_UNAVAILABLE', 'Ce prestataire n’est pas encore raccordé : identifiants manquants côté serveur.');
};

export const ADAPTERS: PaymentAdapter[] = [
  {
    id: 'cash',
    name: 'Espèces à la chauffeuse',
    description: 'Paiement remis en main propre à la fin de la course.',
    mode: 'demo',
    kinds: ['cash'],
    purposes: ['ride'],
    flow: 'cash',
    needsPhone: false,
    configured: () => true,
    initiate: () => notConfigured(),
  },
  {
    id: 'demo-card',
    name: 'Carte bancaire · bac à sable',
    description: 'Page sécurisée simulée (3-D Secure). Cartes de test 4242 / 0002 / 3155.',
    mode: 'demo',
    kinds: ['card'],
    purposes: ['ride', 'recharge'],
    flow: 'hosted_page',
    needsPhone: false,
    configured: () => true,
    initiate: (op) => ({
      providerRef: `demo_${op.kind === 'recharge' ? 'rc' : 'pw'}_${op.id}`,
      flow: 'hosted_page',
      instructions: op.provider.instructions || 'Finalisez le paiement sur la page sécurisée du prestataire.',
      job: manual,
    }),
  },
  {
    id: 'demo-mobile-wallet',
    name: 'Wallet marocain · bac à sable',
    description: 'Demande de paiement envoyée à l’application wallet de la personne, qui la valide.',
    mode: 'demo',
    kinds: ['mobile_wallet'],
    purposes: ['ride', 'recharge'],
    flow: 'wallet_approval',
    needsPhone: true,
    configured: () => true,
    initiate: (op) => ({
      providerRef: `demo_mw_${op.id}`,
      flow: 'wallet_approval',
      instructions: op.provider.instructions || `Ouvrez votre application wallet : une demande de paiement a été envoyée au ${op.payerPhone}. Validez-la pour créditer votre portefeuille Naya.`,
      job: manual,
    }),
  },
  {
    id: 'demo-mobile-payment',
    name: 'Paiement mobile · bac à sable',
    description: 'Paiement par numéro de téléphone, confirmé par code reçu par SMS.',
    mode: 'demo',
    kinds: ['mobile_payment'],
    purposes: ['recharge'],
    flow: 'wallet_approval',
    needsPhone: true,
    configured: () => true,
    initiate: (op) => ({
      providerRef: `demo_mp_${op.id}`,
      flow: 'wallet_approval',
      instructions: op.provider.instructions || `Un code de confirmation a été envoyé par SMS au ${op.payerPhone}. Confirmez le paiement depuis votre téléphone.`,
      job: manual,
    }),
  },
  {
    id: 'demo-cash-network',
    name: 'Réseau d’agences · bac à sable',
    description: 'Code à présenter en agence (Cash Plus, Wafacash…). Le paiement en espèces au guichet crédite le portefeuille.',
    mode: 'demo',
    kinds: ['cash_network'],
    purposes: ['recharge'],
    flow: 'voucher',
    needsPhone: false,
    configured: () => true,
    initiate: (op) => {
      const expiresAt = new Date(op.nowMs + VOUCHER_HOURS * 3_600_000).toISOString();
      return {
        providerRef: `demo_cn_${op.id}`,
        flow: 'voucher',
        voucherCode: voucher(op.id),
        expiresAt,
        instructions: op.provider.instructions || `Présentez ce code et réglez le montant en espèces dans une agence ${op.provider.name.replace(/ \(démo\)$/, '')} sous ${VOUCHER_HOURS} heures.`,
        // An unpaid code expires: the provider then reports a failure.
        job: { outcome: 'failed', reason: 'Code expiré sans paiement en agence.', dueAt: expiresAt },
      };
    },
  },
  {
    id: 'demo-bank-transfer',
    name: 'Virement bancaire · bac à sable',
    description: 'Retraits vers le compte bancaire des chauffeuses (compte ••0000 refusé).',
    mode: 'demo',
    kinds: ['bank_transfer'],
    purposes: ['withdrawal'],
    flow: 'bank_transfer',
    needsPhone: false,
    configured: () => true,
    initiate: () => notConfigured(),
  },
  // Production slots: the contract is the same; only credentials and the HTTP calls differ.
  { id: 'live-card', name: 'PSP carte bancaire (production)', description: 'Acquéreur / passerelle carte avec pages hébergées et webhooks signés.', mode: 'live', kinds: ['card'], purposes: ['ride', 'recharge'], flow: 'hosted_page', needsPhone: false, configured: () => false, initiate: () => notConfigured() },
  { id: 'live-mobile-wallet', name: 'Wallet marocain (production)', description: 'Wallet mobile interopérable : demande de paiement validée dans l’application.', mode: 'live', kinds: ['mobile_wallet', 'mobile_payment'], purposes: ['ride', 'recharge'], flow: 'wallet_approval', needsPhone: true, configured: () => false, initiate: () => notConfigured() },
  { id: 'live-cash-network', name: 'Réseau d’agences (production)', description: 'Paiement en espèces au guichet avec un code de référence.', mode: 'live', kinds: ['cash_network'], purposes: ['recharge'], flow: 'voucher', needsPhone: false, configured: () => false, initiate: () => notConfigured() },
  { id: 'live-bank-transfer', name: 'Virement bancaire (production)', description: 'Prestataire de virement pour les retraits.', mode: 'live', kinds: ['bank_transfer'], purposes: ['withdrawal'], flow: 'bank_transfer', needsPhone: false, configured: () => false, initiate: () => notConfigured() },
];

/** Adapter used by configurations written before adapters existed. */
const DEFAULT_ADAPTER: Record<ProviderKind, string> = {
  cash: 'cash',
  card: 'demo-card',
  bank_transfer: 'demo-bank-transfer',
  cash_network: 'demo-cash-network',
  mobile_wallet: 'demo-mobile-wallet',
  mobile_payment: 'demo-mobile-payment',
};

export function adapterOf(p: PaymentProviderConfig): PaymentAdapter {
  const id = p.adapter ?? (p.mode === 'live' ? `live-${p.kind === 'mobile_payment' ? 'mobile-wallet' : p.kind.replace('_', '-')}` : DEFAULT_ADAPTER[p.kind]);
  const a = ADAPTERS.find((x) => x.id === id);
  if (!a) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE', `Adaptateur de paiement inconnu : ${id}.`);
  return a;
}

export const providerOption = (p: PaymentProviderConfig): ProviderOption => {
  const a = adapterOf(p);
  return { ...p, flow: a.flow, needsPhone: a.needsPhone };
};

/** Providers offered to a person for a purpose, in her city. */
export function providersFor(s: State, cityId: string, purpose: PaymentPurpose, role: 'passenger' | 'driver') {
  return s.providers
    .filter((p) => p.cityId === cityId && p.purpose === purpose && p.enabled && p.configured)
    .filter((p) => purpose !== 'recharge' || !p.audiences?.length || p.audiences.includes(role))
    .map(providerOption);
}

/** Checks a recharge request against the provider settings and starts it with the adapter. */
export function startRecharge(s: State, input: { kind: AdapterOperation['kind']; id: string; amount: Centimes; payerPhone?: string | null; providerId: string; cityId: string; role: 'passenger' | 'driver'; nowMs: number }) {
  const provider = s.providers.find((p) => p.id === input.providerId);
  if (!provider || provider.cityId !== input.cityId || provider.purpose !== 'recharge' || !provider.enabled || !provider.configured) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE');
  if (provider.audiences?.length && !provider.audiences.includes(input.role)) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE');
  if (provider.minAmount && input.amount < provider.minAmount) throw new DomainError('VALIDATION', `Montant minimum pour ${provider.name} : ${provider.minAmount / 100} MAD.`);
  if (provider.maxAmount && input.amount > provider.maxAmount) throw new DomainError('VALIDATION', `Montant maximum pour ${provider.name} : ${provider.maxAmount / 100} MAD.`);
  const adapter = adapterOf(provider);
  if (!adapter.configured()) throw new DomainError('PAYMENT_METHOD_UNAVAILABLE', 'Ce prestataire n’est pas encore raccordé.');
  if (adapter.needsPhone && !input.payerPhone) throw new DomainError('VALIDATION', 'Indiquez le numéro de téléphone associé à votre wallet.');
  const result = adapter.initiate({ kind: input.kind, id: input.id, amount: input.amount, payerPhone: input.payerPhone ?? null, provider, nowMs: input.nowMs });
  s.providerJobs.push({ ...result.job, kind: input.kind, ref: result.providerRef, id: nextId(s, 'PJ', 5), delivered: false });
  return {
    provider,
    providerRef: result.providerRef,
    instructions: {
      flow: result.flow,
      voucherCode: result.voucherCode ?? null,
      expiresAt: result.expiresAt ?? null,
      payerPhone: adapter.needsPhone ? input.payerPhone ?? null : null,
      instructions: result.instructions,
    },
  };
}

/** Back-office catalogue of adapters, to create or reconfigure a provider. */
export const adapterCatalog = () =>
  ADAPTERS.map(({ initiate: _i, configured, ...a }) => ({ ...a, configured: configured() }));

/** Default providers of a city: card, Moroccan wallet, mobile payment, cash networks, payouts. */
export function defaultProviders(cityId: string): PaymentProviderConfig[] {
  const rabat = cityId === 'rabat';
  const p = (x: Omit<PaymentProviderConfig, 'cityId' | 'mode' | 'configured'> & Partial<PaymentProviderConfig>): PaymentProviderConfig => ({ mode: 'demo', configured: true, cityId, ...x });
  return [
    p({ id: `${cityId}-ride-cash`, purpose: 'ride', kind: 'cash', name: 'Espèces', enabled: true, adapter: 'cash' }),
    p({ id: `${cityId}-ride-card`, purpose: 'ride', kind: 'card', name: 'Carte bancaire (démo)', enabled: true, adapter: 'demo-card' }),
    p({ id: `${cityId}-ride-mobile-wallet`, purpose: 'ride', kind: 'mobile_wallet', name: 'Wallet marocain (démo)', enabled: true, adapter: 'demo-mobile-wallet' }),
    p({ id: `${cityId}-recharge-card`, purpose: 'recharge', kind: 'card', name: 'Carte bancaire (démo)', enabled: true, adapter: 'demo-card' }),
    p({ id: `${cityId}-recharge-mobile-wallet`, purpose: 'recharge', kind: 'mobile_wallet', name: 'Wallet marocain (démo)', enabled: true, adapter: 'demo-mobile-wallet', maxAmount: 500_000 }),
    p({ id: `${cityId}-recharge-mobile-payment`, purpose: 'recharge', kind: 'mobile_payment', name: 'Paiement mobile (démo)', enabled: true, adapter: 'demo-mobile-payment', maxAmount: 200_000 }),
    p({ id: `${cityId}-recharge-agency`, purpose: 'recharge', kind: 'cash_network', name: 'Cash Plus (démo)', enabled: rabat, adapter: 'demo-cash-network', minAmount: 2_000 }),
    p({ id: `${cityId}-recharge-wafacash`, purpose: 'recharge', kind: 'cash_network', name: 'Wafacash (démo)', enabled: rabat, adapter: 'demo-cash-network', minAmount: 2_000 }),
    p({ id: `${cityId}-withdrawal-bank`, purpose: 'withdrawal', kind: 'bank_transfer', name: 'Virement bancaire (démo)', enabled: true, adapter: 'demo-bank-transfer' }),
    p({ id: `${cityId}-ride-card-live`, purpose: 'ride', kind: 'card', name: 'Prestataire carte (production)', enabled: false, mode: 'live', configured: false, adapter: 'live-card' }),
    p({ id: `${cityId}-recharge-wallet-live`, purpose: 'recharge', kind: 'mobile_wallet', name: 'Wallet marocain (production)', enabled: false, mode: 'live', configured: false, adapter: 'live-mobile-wallet' }),
  ];
}

/**
 * Brings stored provider lists up to date: adapters on legacy rows, new default providers,
 * and removal of the duplicates the former demo catalogue created (`<city>-demo-*-recharge`).
 */
export function migrateProviders(s: State) {
  s.providers = s.providers.filter((p) => !/-demo-(card|mobile|cashplus|wafacash)-recharge$/.test(p.id));
  for (const p of s.providers) p.adapter ??= adapterOf(p).id;
  for (const city of s.cities)
    for (const d of defaultProviders(city.id)) {
      const existing = s.providers.find((p) => p.id === d.id);
      if (!existing) s.providers.push(d);
      // Former name of the Rabat agency network.
      else if (existing.id.endsWith('-recharge-agency') && existing.name === 'Réseau d’agences (démo)') existing.name = d.name;
    }
}
