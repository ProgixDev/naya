/**
 * Naya design tokens. Surface, text, action and line values are the Figma variables
 * (--naya-*) of file nOuWsQ5MA8CdU5HsSGoXwP. Status hues are an addition: the prototype
 * showed every state in plum, which made failure and success read alike.
 */
export const lightColors = {
  // Figma variables
  background: '#F8F7F9', // quiet pearl; plum is reserved for actions and artwork
  surface: '#FFFFFF', // --naya-surface-critical (legible surface for money and decisions)
  selected: '#EDE3EA',
  ink: '#29232D',
  muted: '#716977',
  inverse: '#FFFFFF', // --naya-text-inverse
  accent: '#6B3657', // --naya-action-primary (deep plum)
  line: '#E7E2E8',
  // Derived
  accentPressed: '#56294A',
  accentDeep: '#3F1B34', // gradient end of the plum wallet card
  mauve: '#B98AA8', // restrained mauve for secondary emphasis and map routes
  mauveSoft: '#F1EBF0',
  elevated: '#FFFFFF',
  glass: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.9)',
  scrim: 'rgba(46,32,44,0.42)',
  disabledFill: '#ECE6EA',
  disabledText: '#A0939E',
  // Status (text on white/pearl ≥ 4.5:1)
  success: '#2F6B4F',
  successSoft: '#E6F2EB',
  warning: '#8A5A12',
  warningSoft: '#FBF0DC',
  danger: '#A5313F',
  dangerSoft: '#F9E5E8',
  info: '#3C5A86',
  infoSoft: '#E6ECF5',
  map: '#EFE9EC',
} as const;

export type ColorToken = keyof typeof lightColors;
export const darkColors: Record<ColorToken, string> = {
  background: '#16121A', surface: '#231D28', selected: '#3A2938', ink: '#F4EDF5', muted: '#BBAFBE', inverse: '#201522', accent: '#E5B6D4', line: '#423648', accentPressed: '#D59AC2', accentDeep: '#382233', mauve: '#CDA0BF', mauveSoft: '#302432', elevated: '#2C2431', glass: 'rgba(35,29,40,0.88)', glassBorder: 'rgba(230,206,231,0.14)', scrim: 'rgba(0,0,0,0.65)', disabledFill: '#332A38', disabledText: '#8A7C91', success: '#9AD5B4', successSoft: '#203A2E', warning: '#F0C982', warningSoft: '#423320', danger: '#FFABB6', dangerSoft: '#48242F', info: '#A9C9F5', infoSoft: '#25344C', map: '#25202B',
};
let scheme: 'light' | 'dark' = 'light';
const listeners = new Set<() => void>();
export const getColorScheme = () => scheme;
export const subscribeColors = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setColorScheme(next: 'light' | 'dark') { if (next !== scheme) { scheme = next; listeners.forEach(fn => fn()); } }
export const colors = new Proxy(lightColors as Record<ColorToken, string>, { get: (_target, key) => (scheme === 'dark' ? darkColors : lightColors)[key as ColorToken] });
/** Style properties are evaluated with the current palette, including module-level styles. */
export function themedStyles<T extends object>(factory: () => T): T { return new Proxy(factory(), { get: (_, key) => factory()[key as keyof T] }); }

/** Inter, real font files loaded with explicit weights. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Type scale (size / line height). Figma styles: Mobile/Titre 30/36, Section/Racine 21/26, Section/Détail 18/24, Texte/Corps 16/22, Texte/Action 15/20, Texte/Secondaire 13/18. */
export const type = {
  hero: { size: 34, line: 39, font: fonts.semibold, tracking: -1.1 },
  screen: { size: 30, line: 36, font: fonts.semibold, tracking: -0.8 },
  display: { size: 44, line: 52, font: fonts.semibold, tracking: -1.3 },
  title: { size: 21, line: 26, font: fonts.semibold, tracking: -0.2 },
  heading: { size: 18, line: 24, font: fonts.semibold, tracking: -0.1 },
  body: { size: 16, line: 22, font: fonts.regular, tracking: 0 },
  bodyStrong: { size: 16, line: 22, font: fonts.medium, tracking: 0 },
  action: { size: 15, line: 20, font: fonts.semibold, tracking: 0 },
  label: { size: 15, line: 20, font: fonts.medium, tracking: 0 },
  caption: { size: 13, line: 18, font: fonts.medium, tracking: 0 },
  micro: { size: 12, line: 16, font: fonts.medium, tracking: 0.1 },
} as const;
export type TypeToken = keyof typeof type;

/** Figma --naya-space-* plus the rhythm used across screens. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export const gutter = 20;

export const radius = { row: 16, card: 22, sheet: 32, pill: 999, field: 18 } as const;

/** Control heights: standard 44, compact 36 (44 touch target via hitSlop), major booking/driver actions 54. */
export const control = { major: 50, standard: 44, compact: 36, chip: 32, field: 56, touch: 44, touchAndroid: 48 } as const;

export const shadow = {
  float: { shadowColor: '#2E202C', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  card: { shadowColor: '#2E202C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  button: { shadowColor: '#6B3657', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
} as const;

export const motion = {
  press: { scale: 0.985, in: 90, out: 140 },
  fast: 140,
  base: 220,
  sheet: { open: 260, close: 200, settle: 220 },
  tabFade: 180,
  navigation: 250,
  easeOut: [0.2, 0.8, 0.2, 1],
} as const;
