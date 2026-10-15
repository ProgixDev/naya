import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { darkColors, lightColors, setColorScheme, type ColorToken } from '@naya/tokens';
import { SegmentedControl } from '../SegmentedControl';

/** WCAG relative luminance of an opaque #RRGGBB colour. */
function luminance(hex: string) {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const palettes = { light: lightColors as Record<ColorToken, string>, dark: darkColors };
const options = [
  { value: 'upcoming', label: 'À venir' },
  { value: 'history', label: 'Historique' },
];

/** Renders the control in one scheme and returns the painted track and thumb styles. */
async function paint(scheme: 'light' | 'dark') {
  setColorScheme(scheme);
  await render(<SegmentedControl options={options} value="upcoming" onChange={() => {}} testID="seg" />);
  const track = screen.getByTestId('seg');
  // The thumb only mounts once the track knows its width.
  await fireEvent(track, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 308, height: 44 } } });
  const thumb = screen.getByTestId('seg-thumb');
  return { track: StyleSheet.flatten(track.props.style), thumb: StyleSheet.flatten(thumb.props.style) };
}

describe('SegmentedControl in both schemes (DM-05)', () => {
  afterEach(() => act(() => setColorScheme('light')));

  it.each(Object.entries(palettes))('%s: the selected thumb is lighter than the track', async (scheme, p) => {
    const { track, thumb } = await paint(scheme as 'light' | 'dark');
    expect(thumb.backgroundColor).toBe(p.elevated);
    expect(luminance(thumb.backgroundColor as string)).toBeGreaterThan(luminance(track.backgroundColor as string));
    expect(thumb.borderColor).toBe(p.hairline);
    expect(thumb.shadowColor).not.toBe(p.ink);
  });

  it('light keeps the mauve track it had before the dark fix', async () => {
    const { track, thumb } = await paint('light');
    expect(track.backgroundColor).toBe(lightColors.selected);
    expect(track.borderColor).toBe('transparent');
    expect(thumb.backgroundColor).toBe('#FFFFFF');
  });

  it('dark sinks the track to the page background with a hairline edge', async () => {
    const { track } = await paint('dark');
    expect(track.backgroundColor).toBe(darkColors.background);
    expect(track.borderColor).toBe(darkColors.hairline);
  });

  it('switching scheme repaints the same control', async () => {
    const { track } = await paint('light');
    expect(track.backgroundColor).toBe(lightColors.selected);
    await act(() => setColorScheme('dark'));
    expect(StyleSheet.flatten(screen.getByTestId('seg').props.style).backgroundColor).toBe(darkColors.background);
    expect(StyleSheet.flatten(screen.getByTestId('seg-thumb').props.style).backgroundColor).toBe(darkColors.elevated);
  });
});
