import { formatDay, formatMoney, formatShort, formatTime, type Centimes } from '@naya/domain';

export { formatMoney, formatShort, formatDay, formatTime };

const dt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Casablanca', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dOnly = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Casablanca', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const fmtDateTime = (iso: string | null | undefined) => (iso ? dt.format(new Date(iso)).replace(':', 'h') : '—');
export const fmtToday = () => {
  const s = dOnly.format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const money = (c: Centimes) => formatMoney(c);
export const signed = (c: Centimes) => formatMoney(c, { sign: 'always' });

/** Parse "12,50" or "12.5" MAD into centimes; null if invalid. */
export function toCentimes(v: string): number | null {
  const t = v.replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const neg = t.startsWith('-');
  const [u, f = ''] = t.replace('-', '').split('.');
  const c = Number(u) * 100 + Number(f.padEnd(2, '0'));
  return neg ? -c : c;
}
export const fromCentimes = (c: number) => (c / 100).toFixed(2).replace('.', ',').replace(',00', '');
