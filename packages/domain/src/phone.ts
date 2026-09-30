export interface Country {
  code: string; // ISO 3166-1 alpha-2
  dial: string;
  name: string;
  /** National significant number length(s). */
  lengths: number[];
  example: string;
}

/** +212 first; the list only includes countries whose numbering is validated here. */
export const COUNTRIES: Country[] = [
  { code: 'MA', dial: '+212', name: 'Maroc', lengths: [9], example: '6 12 34 56 78' },
  { code: 'FR', dial: '+33', name: 'France', lengths: [9], example: '6 12 34 56 78' },
  { code: 'ES', dial: '+34', name: 'Espagne', lengths: [9], example: '612 34 56 78' },
  { code: 'BE', dial: '+32', name: 'Belgique', lengths: [8, 9], example: '470 12 34 56' },
  { code: 'SN', dial: '+221', name: 'Sénégal', lengths: [9], example: '70 123 45 67' },
];

/** Returns an E.164 number or null. Accepts a leading national 0 ("06…"). */
export function toE164(country: Country, input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith(country.dial.slice(1))) digits = digits.slice(country.dial.length - 1);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!country.lengths.includes(digits.length)) return null;
  if (country.code === 'MA' && !/^[5-7]/.test(digits)) return null;
  return `${country.dial}${digits}`;
}

export function formatNational(country: Country, input: string): string {
  const d = input.replace(/\D/g, '').replace(/^0/, '').slice(0, Math.max(...country.lengths));
  return d.replace(/^(\d)(\d{0,2})(\d{0,2})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, e, f) => [a, b, c, e, f].filter(Boolean).join(' '));
}

export const maskPhone = (e164: string) => e164.replace(/^(\+\d{3})(\d)\d{4}(\d{2})(\d{2})$/, '$1 $2 •• •• $3 $4');
