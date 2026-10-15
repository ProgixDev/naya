// Native-only modules pulled in by Screen: their published jest mocks.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));

import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { darkColors, lightColors, setColorScheme, type ColorToken } from '@naya/tokens';
import { Toggle } from '../Toggle';
import { BrandConceptsScreen } from '../features/brand';

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: ReactNode) => <SafeAreaProvider initialMetrics={safeArea}>{ui}</SafeAreaProvider>;

/** WCAG 2.x contrast ratio of two opaque #RRGGBB colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const palettes = { light: lightColors as Record<ColorToken, string>, dark: darkColors };

describe.each(Object.entries(palettes))('%s palette (WCAG 1.4.11 / 1.4.3)', (_name, p) => {
  it.each(['surface', 'background', 'elevated'] as const)('switch off-track stands out at 3:1 on %s', (bg) => {
    expect(contrast(p.outline, p[bg])).toBeGreaterThanOrEqual(3);
  });

  it('switch thumb stands out at 3:1 on the off-track', () => {
    expect(contrast(p.thumb, p.outline)).toBeGreaterThanOrEqual(3);
  });

  it('map attribution text (muted on surface) reaches 4.5:1', () => {
    expect(contrast(p.muted, p.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('dark mode components', () => {
  afterEach(() => act(() => setColorScheme('light')));

  it('Toggle paints its off-track with the outline token, not the faint line', async () => {
    setColorScheme('dark');
    await render(<Toggle value={false} accessibilityLabel="Nouveautés" testID="t" />);
    const sw = screen.getByTestId('t');
    expect(sw.props.tintColor).toBe(darkColors.outline);
    expect(StyleSheet.flatten(sw.props.style).backgroundColor).toBe(darkColors.outline);
    expect(sw.props.onTintColor).toBe(darkColors.accent);
    expect(sw.props.thumbTintColor).toBe(darkColors.thumb);
  });

  it('logo preview tiles stay visible on the dark card, and the caption says which background they show', async () => {
    setColorScheme('dark');
    await render(wrap(<BrandConceptsScreen onBack={() => {}} />));
    expect(screen.getByText(/aperçu sur fond clair\./)).toBeTruthy();
    const tiles = screen.getAllByTestId(/^logo-preview-/);
    expect(tiles.length).toBe(6);
    for (const t of tiles) {
      const bg = StyleSheet.flatten(t.props.style).backgroundColor as string;
      expect(contrast(bg, darkColors.surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('light mode keeps the dark preview tile', async () => {
    await render(wrap(<BrandConceptsScreen onBack={() => {}} />));
    expect(screen.getByText(/aperçu sur fond sombre\./)).toBeTruthy();
  });
});
