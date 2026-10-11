/**
 * Original vector spot illustrations, one per context. Drawn in-house from simple shapes in the
 * brand colours, so they follow the theme (light and dark) and contain no generated imagery.
 */
export type Spot = 'journey' | 'schedule' | 'verified' | 'support' | 'earnings' | 'wallet' | 'drive' | 'car';

/** Width / height of each spot; the car is wider than the scenes. */
export const spotAspect = (spot: Spot) => (spot === 'car' ? 320 / 180 : 320 / 240);

const halo = (a: string) =>
  `<ellipse cx="160" cy="130" rx="132" ry="98" fill="${a}" opacity=".07"/><circle cx="44" cy="62" r="5" fill="${a}" opacity=".25"/><circle cx="282" cy="46" r="4" fill="${a}" opacity=".2"/><circle cx="290" cy="206" r="6" fill="${a}" opacity=".14"/>`;

const scenes: Record<Exclude<Spot, 'car'>, (a: string, s: string) => string> = {
  // A route on a city map, from a pickup dot to a destination pin.
  journey: (a, s) =>
    `<rect x="50" y="46" width="220" height="152" rx="22" fill="${s}" stroke="${a}" stroke-width="4"/><path d="M50 112H270M152 46V198M92 198L152 112L212 46" stroke="${a}" stroke-width="3" opacity=".1"/><path d="M96 166C120 122 168 150 188 114S212 86 226 84" stroke="${a}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 11" fill="none"/><circle cx="96" cy="166" r="10" fill="${s}" stroke="${a}" stroke-width="5"/><path d="M226 104C214 90 208 81 208 73A18 18 0 0 1 244 73C244 81 238 90 226 104Z" fill="${a}"/><circle cx="226" cy="72" r="6" fill="${s}"/>`,
  // A calendar with one booked day and a clock: plan a ride ahead.
  schedule: (a, s) =>
    `<rect x="72" y="54" width="168" height="150" rx="20" fill="${s}" stroke="${a}" stroke-width="4"/><path d="M72 74A20 20 0 0 1 92 54H220A20 20 0 0 1 240 74V92H72Z" fill="${a}"/><rect x="106" y="40" width="10" height="26" rx="5" fill="${s}" stroke="${a}" stroke-width="4"/><rect x="196" y="40" width="10" height="26" rx="5" fill="${s}" stroke="${a}" stroke-width="4"/>${[104, 136, 168, 200].flatMap((x) => [118, 146, 174].map((y) => (x === 168 && y === 146 ? '' : `<circle cx="${x}" cy="${y}" r="5" fill="${a}" opacity=".18"/>`))).join('')}<circle cx="168" cy="146" r="15" fill="${a}"/><path d="M161 146L166 151L176 140" stroke="${s}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="244" cy="186" r="30" fill="${s}" stroke="${a}" stroke-width="4"/><path d="M244 170V186L255 193" stroke="${a}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  // An ID card with a shield check: a verified, reviewed account.
  verified: (a, s) =>
    `<rect x="50" y="62" width="184" height="122" rx="18" fill="${s}" stroke="${a}" stroke-width="4"/><rect x="70" y="86" width="58" height="72" rx="10" fill="${a}" opacity=".12"/><circle cx="99" cy="111" r="11" fill="${a}"/><path d="M79 148Q99 124 119 148" stroke="${a}" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M146 98H206" stroke="${a}" stroke-width="5" stroke-linecap="round"/><path d="M146 120H190M146 142H198" stroke="${a}" stroke-width="5" stroke-linecap="round" opacity=".3"/><path d="M240 124L276 137V163C276 187 260 203 240 211C220 203 204 187 204 163V137Z" fill="${a}" stroke="${s}" stroke-width="5" stroke-linejoin="round"/><path d="M226 166L236 176L255 155" stroke="${s}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  // Two speech bubbles and a heart: someone from Naya answers.
  support: (a, s) =>
    `<path d="M96 146L88 178L122 146Z" fill="${s}" stroke="${a}" stroke-width="4" stroke-linejoin="round"/><rect x="58" y="56" width="156" height="94" rx="24" fill="${s}" stroke="${a}" stroke-width="4"/><path d="M84 92H186" stroke="${a}" stroke-width="6" stroke-linecap="round" opacity=".35"/><path d="M84 116H150" stroke="${a}" stroke-width="6" stroke-linecap="round" opacity=".35"/><rect x="148" y="120" width="116" height="72" rx="22" fill="${a}"/><path d="M234 190L248 214L210 190Z" fill="${a}"/><circle cx="180" cy="156" r="6" fill="${s}"/><circle cx="206" cy="156" r="6" fill="${s}"/><circle cx="232" cy="156" r="6" fill="${s}"/><path d="M254 82C243 74 236 68 236 60A9 9 0 0 1 254 56A9 9 0 0 1 272 60C272 68 265 74 254 82Z" fill="${a}" opacity=".8"/>`,
  // Rising bars, a trend arrow and a coin: earnings that add up.
  earnings: (a, s) =>
    `<path d="M58 200H262" stroke="${a}" stroke-width="3" stroke-linecap="round" opacity=".25"/><rect x="76" y="152" width="32" height="48" rx="9" fill="${a}" opacity=".22"/><rect x="122" y="126" width="32" height="74" rx="9" fill="${a}" opacity=".42"/><rect x="168" y="98" width="32" height="102" rx="9" fill="${a}" opacity=".68"/><rect x="214" y="66" width="32" height="134" rx="9" fill="${a}"/><path d="M80 128L132 98L176 108L226 50" stroke="${a}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M206 48H228V70" stroke="${a}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="90" cy="70" r="27" fill="${s}" stroke="${a}" stroke-width="4"/><text x="90" y="77" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="18" fill="${a}">DH</text>`,
  // A wallet with a card tucked in.
  wallet: (a, s) =>
    `<rect x="100" y="50" width="140" height="86" rx="14" fill="${a}" opacity=".22" transform="rotate(-8 170 93)"/><rect x="62" y="88" width="196" height="118" rx="22" fill="${s}" stroke="${a}" stroke-width="4"/><path d="M62 118H258" stroke="${a}" stroke-width="3" opacity=".15"/><rect x="178" y="128" width="80" height="44" rx="14" fill="${a}"/><circle cx="202" cy="150" r="7" fill="${s}"/>`,
  // A steering wheel: she drives, on her own schedule.
  drive: (a, s) =>
    `<circle cx="160" cy="124" r="66" fill="${s}" stroke="${a}" stroke-width="12"/><path d="M96 124H144M176 124H224M160 140V188" stroke="${a}" stroke-width="12" stroke-linecap="round"/><circle cx="160" cy="124" r="17" fill="${a}"/><path d="M60 214H260" stroke="${a}" stroke-width="4" stroke-linecap="round" stroke-dasharray="18 14" opacity=".3"/>`,
};

/** Side view of the Naya car (vector). */
export const vehicleSvg = (a: string, s: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><path d="M23 143H299" stroke="${a}" opacity=".18" stroke-width="3"/><path d="M43 120V95Q43 86 60 83L88 50Q92 43 106 43H212Q225 43 234 55L257 84Q281 87 283 100V120Z" fill="${s}" stroke="${a}" stroke-width="5" stroke-linejoin="round"/><path d="M103 53H150V80H81ZM163 53H209L230 80H163Z" fill="${a}" opacity=".2"/><path d="M56 103H72M258 103H274M162 89V116M129 92H143M206 92H220" stroke="${a}" stroke-width="4" stroke-linecap="round"/><circle cx="94" cy="121" r="21" fill="${s}" stroke="${a}" stroke-width="5"/><circle cx="236" cy="121" r="21" fill="${s}" stroke="${a}" stroke-width="5"/><circle cx="94" cy="121" r="8" fill="${a}"/><circle cx="236" cy="121" r="8" fill="${a}"/></svg>`;

/** Top view of the car, for map markers (30 × 56). */
export const carTopSvg = (a: string, s: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 56"><rect x="3" y="2" width="24" height="52" rx="8" fill="${s}" stroke="${a}" stroke-width="3"/><path d="M7 16H23L21 25H9ZM9 35H21L23 44H7Z" fill="${a}"/></svg>`;
export const carTopAspect = 30 / 56;

export function spotSvg(spot: Spot, accent: string, surface: string) {
  if (spot === 'car') return vehicleSvg(accent, surface);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">${halo(accent)}${scenes[spot](accent, surface)}</svg>`;
}
