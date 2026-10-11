// Generates the fictional SPÉCIMEN documents used by the demo seed, drawn in vector (no photos,
// no generated imagery). Run from the repo root: node services/demo-api/scripts/generate-fixtures.mjs
// Needs Google Chrome; Playwright (installed in e2e/) drives it to rasterise the SVGs to JPEG.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(join(process.cwd(), 'e2e', 'package.json'))('playwright');
const OUT = fileURLToPath(new URL('../fixtures/', import.meta.url));
const INK = '#2E202C';
const MUTED = '#756775';
const PLUM = '#6B3657';

/** Flat drawn portrait. `hijab` covers the hair; skin and colours vary per person. */
function portrait({ skin, hair, top, hijab = false }, w = 250, h = 300) {
  const cx = w / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 250 300">
    <rect width="250" height="300" fill="#F4ECF1"/>
    <circle cx="210" cy="40" r="60" fill="#EADCE5"/>
    <path d="M20 300C24 236 70 214 125 214S226 236 230 300Z" fill="${top}"/>
    <rect x="${cx - 18}" y="176" width="36" height="46" rx="14" fill="${skin}"/>
    ${hijab
      ? `<path d="M52 150C52 82 84 52 125 52S198 82 198 150C198 214 160 238 125 238S52 214 52 150Z" fill="${hair}"/>`
      : `<path d="M58 140C56 80 86 54 125 54S194 80 192 140L196 226C170 214 160 196 160 196H90C90 196 80 214 54 226Z" fill="${hair}"/>`}
    <ellipse cx="125" cy="140" rx="${hijab ? 46 : 50}" ry="58" fill="${skin}"/>
    ${hijab ? '' : `<path d="M74 118C84 82 112 74 128 76C150 78 172 92 176 120C160 104 136 96 112 100C96 102 84 108 74 118Z" fill="${hair}"/>`}
    <ellipse cx="106" cy="140" rx="5" ry="6" fill="${INK}"/>
    <ellipse cx="144" cy="140" rx="5" ry="6" fill="${INK}"/>
    <path d="M98 126Q106 121 114 125M136 125Q144 121 152 126" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="M125 146Q121 160 126 162" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".45"/>
    <path d="M110 174Q125 184 140 174" stroke="#9C4A5E" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="94" cy="162" rx="9" ry="5" fill="#E79A9A" opacity=".35"/>
    <ellipse cx="156" cy="162" rx="9" ry="5" fill="#E79A9A" opacity=".35"/>
  </svg>`;
}

const PEOPLE = {
  salma: { skin: '#E8B996', hair: '#2B1B17', top: '#6B3657' },
  amina: { skin: '#C98E6B', hair: '#5E2D4C', top: '#3F6B5A', hijab: true },
};

function card(title, lines, { face = null, tint = '#F0E4EC', blur = 0 } = {}) {
  const x = face ? 330 : 48;
  const rows = lines
    .map(([k, v], i) => `<text x="${x}" y="${208 + i * 84}" font-size="22" font-weight="600" fill="${MUTED}" letter-spacing="1">${k.toUpperCase()}</text><text x="${x}" y="${244 + i * 84}" font-size="34" font-weight="500" fill="${INK}">${v}</text>`)
    .join('');
  const img = face ? `<image href="data:image/svg+xml;base64,${Buffer.from(portrait(PEOPLE[face])).toString('base64')}" x="48" y="170" width="250" height="300"/><rect x="48" y="170" width="250" height="300" rx="14" fill="none" stroke="#D6C4D0" stroke-width="3"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630" viewBox="0 0 1000 630" font-family="Inter, Arial, sans-serif">
    <defs><filter id="b"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>
    <g filter="${blur ? 'url(#b)' : ''}">
      <rect x="2" y="2" width="996" height="626" rx="36" fill="${tint}" stroke="#D6C4D0" stroke-width="4"/>
      <text x="48" y="64" font-size="24" font-weight="600" fill="${MUTED}">ROYAUME FICTIF · DOCUMENT DE DÉMONSTRATION</text>
      <text x="48" y="126" font-size="44" font-weight="700" fill="${INK}">${title}</text>
      ${img}${rows}
      <text x="140" y="380" font-size="76" font-weight="800" fill="${PLUM}" opacity=".25" transform="rotate(-16 500 315)">SPÉCIMEN · FICTIF</text>
    </g>
  </svg>`;
}

/** Side view of the Naya car on a soft studio background (vector). */
function vehiclePhoto(body, glass) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="610" viewBox="0 0 1080 610">
    <rect width="1080" height="610" fill="#ECE8EC"/>
    <ellipse cx="540" cy="470" rx="420" ry="38" fill="#2E202C" opacity=".12"/>
    <g transform="translate(110 80) scale(2.7)">
      <path d="M43 120V95Q43 86 60 83L88 50Q92 43 106 43H212Q225 43 234 55L257 84Q281 87 283 100V120Z" fill="${body}" stroke="#2E202C" stroke-opacity=".25" stroke-width="2" stroke-linejoin="round"/>
      <path d="M103 53H150V80H81ZM163 53H209L230 80H163Z" fill="${glass}"/>
      <path d="M56 103H72M258 103H274M162 89V116" stroke="#2E202C" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
      <circle cx="94" cy="121" r="21" fill="#2E202C"/><circle cx="236" cy="121" r="21" fill="#2E202C"/>
      <circle cx="94" cy="121" r="9" fill="#C9C2C8"/><circle cx="236" cy="121" r="9" fill="#C9C2C8"/>
    </g>
    <text x="40" y="580" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="#756775">PHOTO DE DÉMONSTRATION · VÉHICULE FICTIF</text>
  </svg>`;
}

const selfie = (who) => `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="627" viewBox="0 0 360 627">
  <rect width="360" height="627" fill="#F4ECF1"/>
  <image href="data:image/svg+xml;base64,${Buffer.from(portrait(PEOPLE[who])).toString('base64')}" x="0" y="120" width="360" height="432"/>
  <text x="180" y="600" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="600" fill="#756775">SELFIE FICTIF · DÉMO</text>
</svg>`;

const docs = {
  'salma-id-front': card('Carte d’identité', [['Nom', 'Salma El Mansouri'], ['Née le', '1996-04-12'], ['N° de document', 'AB123456']], { face: 'salma' }),
  'amina-id-front': card('Carte d’identité', [['Nom', 'Amina Bennani'], ['Née le', '1988-09-03'], ['N° de document', 'CD654321']], { face: 'amina' }),
  'generic-id-front': card('Carte d’identité', [['Nom', 'Titulaire fictive'], ['Née le', '1994-01-01'], ['N° de document', 'ZZ000000']]),
  ...Object.fromEntries(['salma', 'amina', 'generic'].map((w) => [`${w}-id-back`, card('Carte d’identité · verso', [['Adresse', 'Adresse fictive, Rabat'], ['Valable jusqu’au', '2031-12-31'], ['Mention', 'Aucune donnée réelle']])])),
  'amina-licence': card('Permis de conduire', [['Titulaire', 'Amina Bennani'], ['Catégorie', 'B'], ['Délivré le', '2012-06-18']], { face: 'amina' }),
  'generic-licence-blurry': card('Permis de conduire', [['Titulaire', 'Photo floue'], ['Catégorie', 'B'], ['Délivré le', '—']], { blur: 9 }),
  'vehicle-registration': card('Carte grise', [['Véhicule', 'Naya Signature · Perle'], ['Immatriculation', 'DÉMO-001'], ['Mise en circulation', '2024-02-01']], { tint: '#ECEEF2' }),
  'vehicle-registration-2': card('Carte grise', [['Véhicule', 'Naya Signature · Prune'], ['Immatriculation', 'DÉMO-002'], ['Mise en circulation', '2023-05-14']], { tint: '#ECEEF2' }),
  insurance: card('Attestation d’assurance', [['Assurée', 'Titulaire fictive'], ['Validité', '2026-01-01 → 2026-12-31'], ['Compagnie', 'Assureur fictif']], { tint: '#EEF2EC' }),
  'vehicle-pearl': vehiclePhoto('#F4F1EE', '#9FB3C8'),
  'vehicle-plum': vehiclePhoto('#6B3657', '#B9C7D6'),
  'salma-selfie': selfie('salma'),
  'amina-selfie': selfie('amina'),
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const [name, svg] of Object.entries(docs)) {
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  await page.setViewportSize({ width: Number(w), height: Number(h) });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.waitForTimeout(60);
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: Number(w), height: Number(h) } });
}
await browser.close();
console.log(`fixtures ok · ${Object.keys(docs).length} files`);
