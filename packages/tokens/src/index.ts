/**
 * Naya design tokens. Surface, text, action and line values are the Figma variables
 * (--naya-*) of file nOuWsQ5MA8CdU5HsSGoXwP. Status hues are an addition: the prototype
 * showed every state in plum, which made failure and success read alike.
 */
export const colors = {
  // Figma variables
  background: '#FAF4F7', // --naya-surface-base (pearl)
  surface: '#FFFFFF', // --naya-surface-critical (legible surface for money and decisions)
  selected: '#EBDCE6', // --naya-surface-selected
  ink: '#2E202C', // --naya-text-primary
  muted: '#756775', // --naya-text-muted (4.9:1 on pearl)
  inverse: '#FFFFFF', // --naya-text-inverse
  accent: '#6B3657', // --naya-action-primary (deep plum)
  line: '#DCCED8', // --naya-line-subtle
  // Derived
  accentPressed: '#56294A',
  accentDeep: '#3F1B34', // gradient end of the plum wallet card
  mauve: '#B98AA8', // restrained mauve for secondary emphasis and map routes
  mauveSoft: '#F3E9EF', // tinted fill for secondary pills
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

export type ColorToken = keyof typeof colors;

/** Inter, real font files loaded with explicit weights. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Type scale (size / line height). Figma styles: Mobile/Titre 30/36, Section/Racine 21/26, Section/Détail 18/24, Texte/Corps 16/22, Texte/Action 15/20, Texte/Secondaire 13/18. */
export const type = {
  hero: { size: 30, line: 36, font: fonts.semibold, tracking: -0.4 },
  display: { size: 40, line: 46, font: fonts.semibold, tracking: -0.8 }, // money hero
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

export const radius = { row: 12, card: 20, sheet: 28, pill: 999, field: 14 } as const;

/** Control heights: standard 44, compact 36 (44 touch target via hitSlop), major booking/driver actions 54. */
export const control = { major: 54, standard: 44, compact: 36, chip: 32, touch: 44, touchAndroid: 48 } as const;

export const shadow = {
  float: { shadowColor: '#2E202C', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  card: { shadowColor: '#2E202C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  button: { shadowColor: '#6B3657', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
} as const;

export const motion = {
  press: { scale: 0.96, damping: 18, stiffness: 320 },
  fast: 140,
  base: 220,
  sheet: { damping: 26, stiffness: 260, mass: 0.9 },
  tabFade: 180,
} as const;
