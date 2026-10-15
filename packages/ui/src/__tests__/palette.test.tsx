/**
 * Palette guard (dark-mode audit, rule 4). Computes WCAG 2.x contrast from the token values, so
 * a token change that breaks either scheme fails here before anyone looks at a screen.
 * The tokens package has no test runner, so this lives with the packages/ui jest tests.
 * Also covers the runtime contract of @naya/tokens: themedStyles caching (DM-19) and the
 * scheme-aware shadow tokens (DM-07).
 */
import { darkColors, getColorScheme, lightColors, setColorScheme, shadow, themedStyles, colors, type ColorToken } from '@naya/tokens';

type Palette = Record<ColorToken, string>;

function rgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) throw new Error(`Expected an opaque #RRGGBB colour, got ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const palettes: [string, Palette][] = [
  ['light', lightColors],
  ['dark', darkColors],
];

describe.each(palettes)('%s palette', (_name, p) => {
  const pairs = (fg: ColorToken[], bg: ColorToken[]) => fg.flatMap((f) => bg.map((b) => [f, b] as const));

  it.each(pairs(['ink', 'muted', 'accent'], ['surface', 'background']))('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(pairs(['outline'], ['surface', 'background']))('control boundary %s on %s is at least 3:1', (fg, bg) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(3);
  });

  // Placeholders use `muted` (never `disabledText`): they carry the field's instruction.
  it.each(pairs(['muted'], ['surface', 'elevated']))('placeholder %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('segmented thumb (elevated) is lighter than its track (background)', () => {
    expect(luminance(p.elevated)).toBeGreaterThan(luminance(p.background));
  });
});

describe('themedStyles (DM-19)', () => {
  afterEach(() => setColorScheme('light'));

  it('runs the factory at most once per scheme and returns stable objects while the scheme is unchanged', () => {
    const factory = jest.fn(() => ({ card: { backgroundColor: colors.surface } }));
    const styles = themedStyles(factory);
    expect(factory).not.toHaveBeenCalled();
    setColorScheme('light');
    const first = styles.card;
    expect(styles.card).toBe(first);
    expect(first.backgroundColor).toBe(lightColors.surface);
    setColorScheme('dark');
    expect(styles.card.backgroundColor).toBe(darkColors.surface);
    expect(styles.card).toBe(styles.card);
    setColorScheme('light');
    expect(styles.card).toBe(first);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('supports spreading and key enumeration', () => {
    const styles = themedStyles(() => ({ a: { color: colors.ink }, b: { color: colors.muted } }));
    expect(Object.keys(styles)).toEqual(['a', 'b']);
    expect('a' in styles).toBe(true);
    expect({ ...styles }.b).toEqual({ color: lightColors.muted });
  });

  it('keeps the scheme store on globalThis, shared with any re-executed copy of the module', () => {
    setColorScheme('dark');
    expect((globalThis as { __nayaTheme?: { scheme: string } }).__nayaTheme?.scheme).toBe('dark');
    expect(getColorScheme()).toBe('dark');
  });
});

describe('shadow tokens (DM-07)', () => {
  afterEach(() => setColorScheme('light'));

  it('keeps the light values unchanged', () => {
    setColorScheme('light');
    expect(shadow.float).toEqual({ shadowColor: '#2E202C', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 5 });
    expect(shadow.card).toEqual({ shadowColor: '#2E202C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 });
    expect(shadow.button).toEqual({ shadowColor: '#6B3657', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 });
  });

  it('uses black at a higher opacity in dark, also when spread inside a themedStyles factory', () => {
    const styles = themedStyles(() => ({ card: { backgroundColor: colors.surface, ...shadow.card } }));
    setColorScheme('dark');
    for (const key of ['float', 'card', 'button'] as const) {
      expect(shadow[key].shadowColor).toBe('#000000');
      expect(shadow[key].shadowOpacity).toBeGreaterThanOrEqual(0.3);
    }
    expect({ ...shadow.float }.shadowColor).toBe('#000000');
    expect(styles.card.shadowColor).toBe('#000000');
    setColorScheme('light');
    expect(styles.card.shadowColor).toBe('#2E202C');
  });
});
