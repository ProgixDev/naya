/** Original vector sketches for the prototype. No generated photos or illustrations. */
export const logoConcepts = [
  {
    id: 'route',
    name: '01 · Le chemin',
    description: 'Un N continu, deux directions qui se rencontrent.',
  },
  {
    id: 'shelter',
    name: '02 · L’abri',
    description: 'Un toit ouvert autour d’un trajet. Protection et famille.',
  },
  {
    id: 'ribbon',
    name: '03 · Le ruban',
    description: 'Une boucle souple pour le lien entre cliente et chauffeuse.',
  },
  {
    id: 'compass',
    name: '04 · La boussole',
    description: 'Une rose à quatre pointes, pensée pour les petites icônes.',
  },
  {
    id: 'petal',
    name: '05 · Le pétale',
    description: 'Trois formes liées, une identité chaleureuse et collective.',
  },
  {
    id: 'gate',
    name: '06 · La porte',
    description: 'Deux arches urbaines, une arrivée et un nouveau départ.',
  },
] as const;
export type ConceptId = (typeof logoConcepts)[number]['id'];
const paths: Record<ConceptId, string> = {
  route:
    '<path d="M20 78V24L76 78V24" fill="none" stroke="COLOR" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="24" r="7" fill="COLOR"/><circle cx="76" cy="78" r="7" fill="COLOR"/>',
  shelter:
    '<path d="M18 47L50 18L82 47M28 41V78H72V41" fill="none" stroke="COLOR" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M43 70V51L59 70V51" fill="none" stroke="COLOR" stroke-width="6" stroke-linecap="round"/>',
  ribbon:
    '<path d="M50 48C10 5 9 78 36 77C61 76 57 22 77 24C96 26 85 94 50 48Z" fill="none" stroke="COLOR" stroke-width="9" stroke-linejoin="round"/>',
  compass:
    '<path d="M50 12L60 40L88 50L60 60L50 88L40 60L12 50L40 40Z" fill="COLOR"/><circle cx="50" cy="50" r="9" fill="BACKGROUND"/>',
  petal:
    '<path d="M50 55C17 57 13 19 36 20C53 21 50 40 50 55ZM50 55C49 24 84 14 84 39C84 58 66 55 50 55ZM50 55C77 65 65 96 45 82C32 72 40 63 50 55Z" fill="COLOR"/>',
  gate: '<path d="M19 80V40C19 12 49 12 49 40V80M51 80V40C51 12 81 12 81 40V80" fill="none" stroke="COLOR" stroke-width="9" stroke-linecap="round"/><path d="M32 80L68 44" stroke="COLOR" stroke-width="7" stroke-linecap="round"/>',
};
export function conceptSvg(
  id: ConceptId,
  color = '#6B3657',
  horizontal = false,
  background = 'transparent',
) {
  const symbol = paths[id]
    .replaceAll('COLOR', color)
    .replaceAll(
      'BACKGROUND',
      background === 'transparent' ? '#F8F7F9' : background,
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${horizontal ? 260 : 100} 100"><rect width="${horizontal ? 260 : 100}" height="100" rx="22" fill="${background}"/>${symbol}${horizontal ? `<text x="110" y="66" font-family="Inter,Arial,sans-serif" font-weight="600" font-size="46" letter-spacing="-2" fill="${color}">naya</text>` : ''}</svg>`;
}
export const vehicleSvg = (color: string, surface: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><path d="M23 143H299" stroke="${color}" opacity=".18" stroke-width="3"/><path d="M43 120V95Q43 86 60 83L88 50Q92 43 106 43H212Q225 43 234 55L257 84Q281 87 283 100V120Z" fill="${surface}" stroke="${color}" stroke-width="5" stroke-linejoin="round"/><path d="M103 53H150V80H81ZM163 53H209L230 80H163Z" fill="${color}" opacity=".2"/><path d="M56 103H72M258 103H274M162 89V116M129 92H143M206 92H220" stroke="${color}" stroke-width="4" stroke-linecap="round"/><circle cx="94" cy="121" r="21" fill="${surface}" stroke="${color}" stroke-width="5"/><circle cx="236" cy="121" r="21" fill="${surface}" stroke="${color}" stroke-width="5"/><circle cx="94" cy="121" r="8" fill="${color}"/><circle cx="236" cy="121" r="8" fill="${color}"/></svg>`;
export const journeySvg = (
  color: string,
  surface: string,
  kind: 'journey' | 'identity' | 'wallet',
) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><circle cx="160" cy="125" r="91" fill="${color}" opacity=".07"/><path d="M62 185C20 136 97 154 115 106S228 28 269 89" stroke="${color}" stroke-width="3" stroke-dasharray="6 9" fill="none" opacity=".4"/><rect x="103" y="42" width="116" height="174" rx="23" fill="${surface}" stroke="${color}" stroke-width="4"/><path d="M141 58H181" stroke="${color}" stroke-width="4" stroke-linecap="round"/>${kind === 'identity' ? `<rect x="122" y="91" width="79" height="71" rx="10" fill="${color}" opacity=".12"/><circle cx="147" cy="116" r="11" fill="${color}"/><path d="M130 141Q147 120 164 141M175 114H189M175 128H189" stroke="${color}" stroke-width="4" fill="none"/>` : kind === 'wallet' ? `<rect x="121" y="94" width="91" height="62" rx="10" fill="${surface}" stroke="${color}" stroke-width="4"/><path d="M180 112H212V138H180Z" fill="${color}"/><circle cx="191" cy="125" r="3" fill="${surface}"/>` : `<path d="M134 160C112 134 172 147 157 106S193 84 191 88" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="134" cy="160" r="8" fill="${color}"/><path d="M184 88L191 68L198 88Z" fill="${color}"/>`}<circle cx="161" cy="194" r="7" fill="${color}" opacity=".2"/></svg>`;
