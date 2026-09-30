/**
 * Money is always an integer number of centimes (1 MAD = 100 centimes).
 * Rates are integer basis points (1 % = 100 bp, ×1.2 = 12 000 bp).
 *
 * Rounding policy (documented in docs/FINANCE.md): every derived amount is rounded
 * half away from zero to the nearest centime, once, at the point it is derived.
 * No binary floating-point value ever becomes a stored amount.
 */
export type Centimes = number & { readonly __brand?: 'centimes' };
export type BasisPoints = number & { readonly __brand?: 'bp' };

export const CURRENCY = 'MAD' as const;
export type Currency = typeof CURRENCY;

export function assertCentimes(value: number, label = 'amount'): asserts value is Centimes {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer number of centimes, got ${value}`);
}

export const mad = (units: number): Centimes => {
  const c = Math.round(units * 100);
  assertCentimes(c);
  return c;
};

/** Integer division rounded half away from zero, exact for safe integers. */
export function divRound(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) {
    throw new RangeError(`divRound needs safe integers, got ${numerator}/${denominator}`);
  }
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const q = Math.floor(n / d);
  const r = n - q * d;
  const rounded = r * 2 >= d ? q + 1 : q;
  return sign * rounded || 0;
}

/** amount × bp / 10 000, rounded half away from zero. */
export function applyBp(amount: Centimes, bp: BasisPoints): Centimes {
  assertCentimes(amount);
  if (!Number.isSafeInteger(bp)) throw new RangeError('basis points must be integers');
  return divRound(amount * bp, 10_000);
}

export function sum(values: readonly Centimes[]): Centimes {
  let total = 0;
  for (const v of values) {
    assertCentimes(v);
    total += v;
  }
  return total;
}

/** Thousands grouped with a narrow no-break space (French typography), independent of the runtime's Intl data. */
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');

/**
 * French display: "100 MAD", "128,40 MAD", "−15 MAD". Uses a true minus sign and
 * a narrow no-break space before the currency so amounts never wrap.
 */
export function formatMoney(amount: Centimes, opts: { sign?: 'auto' | 'always'; currency?: boolean } = {}): string {
  assertCentimes(amount);
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const units = Math.floor(abs / 100);
  const cents = abs % 100;
  const unitsText = group(units);
  const body = cents === 0 ? unitsText : `${unitsText},${String(cents).padStart(2, '0')}`;
  const sign = negative ? '−' : opts.sign === 'always' && amount > 0 ? '+' : '';
  return opts.currency === false ? `${sign}${body}` : `${sign}${body} MAD`;
}

export function formatBp(bp: BasisPoints): string {
  const whole = Math.trunc(bp / 100);
  const frac = Math.abs(bp % 100);
  return frac === 0 ? `${whole} %` : `${whole},${String(frac).padStart(2, '0').replace(/0$/, '')} %`;
}

/** ×1,2 style multiplier label from basis points (12 000 → "×1,2"). */
export function formatMultiplier(bp: BasisPoints): string {
  const s = (bp / 10_000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
  return `×${s}`;
}

/** Parse a user-typed French amount ("50", "50,5", "1 200,00") into centimes, or null. */
export function parseMoneyInput(text: string): Centimes | null {
  const cleaned = text.replace(/[\s  ]/g, '').replace(/MAD$/i, '');
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(cleaned)) return null;
  const [u, f = ''] = cleaned.split(/[.,]/);
  return Number(u) * 100 + Number(f.padEnd(2, '0'));
}
