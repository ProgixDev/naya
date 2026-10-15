/**
 * Runtime light/dark theme (ADR-0023, UI-09, PAX-01).
 * - The palette is seeded from the device before the first render, then the stored choice applies.
 * - A mounted component built with themedStyles repaints (same instance, no remount) when the
 *   person changes the preference, and in 'system' mode when the device changes.
 * - Guard: no colour is read at import, no component reads colours without useTheme(), and no
 *   hook caches a colour without the scheme in its deps.
 */

// iOS-like Appearance: the native value changes only through change events, never synchronously
// after setColorScheme (RCTAppearance). Starts dark, like a phone in dark mode.
jest.mock('react-native/Libraries/Utilities/Appearance', () => {
  const state = { native: 'dark', set: [] as string[], listeners: new Set<(mockEvent: { colorScheme: string }) => void>() };
  return {
    __mock: state,
    getColorScheme: () => state.native,
    setColorScheme: (s: string) => {
      state.set.push(s);
    },
    addChangeListener: (fn: (mockEvent: { colorScheme: string }) => void) => {
      state.listeners.add(fn);
      return { remove: () => state.listeners.delete(fn) };
    },
  };
});
// The person chose « Clair » in a previous session.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>([['naya.theme', 'light']]);
  return { __esModule: true, default: { getItem: jest.fn(async (mockKey: string) => store.get(mockKey) ?? null), setItem: jest.fn(async (mockKey: string, mockValue: string) => void store.set(mockKey, mockValue)) } };
});

import { act, render, screen } from '@testing-library/react-native';
import { memo, useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { darkColors, getColorScheme, lightColors, themedStyles, colors } from '@naya/tokens';
import { getThemeMode, setThemeMode, themeLoaded, useTheme } from '../core/theme';
import { Text } from '../Text';

type AppearanceMock = { native: string; set: string[]; listeners: Set<(p: { colorScheme: string }) => void> };
const appearance = (jest.requireMock('react-native/Libraries/Utilities/Appearance') as { __mock: AppearanceMock }).__mock;
const emitSystem = async (colorScheme: 'light' | 'dark') => {
  appearance.native = colorScheme;
  await act(() => appearance.listeners.forEach((fn) => fn({ colorScheme })));
};
const schemeAtImport = getColorScheme();

// A home-like card: module-level styles through themedStyles, Text inside, and a memoised child.
const styles = themedStyles(() => ({ card: { backgroundColor: colors.surface, borderColor: colors.line } }));
let mounts = 0;
const Badge = memo(function Badge() {
  useTheme();
  return <View testID="badge" style={{ backgroundColor: colors.accent }} />;
});
function Card() {
  useTheme();
  useEffect(() => {
    mounts += 1;
  }, []);
  return (
    <View testID="card" style={styles.card}>
      <Text testID="title">On y va ?</Text>
      <Badge />
    </View>
  );
}
const paint = () => ({
  card: StyleSheet.flatten(screen.getByTestId('card').props.style).backgroundColor,
  title: StyleSheet.flatten(screen.getByTestId('title').props.style).color,
  badge: StyleSheet.flatten(screen.getByTestId('badge').props.style).backgroundColor,
});
const darkPaint = { card: darkColors.surface, title: darkColors.ink, badge: darkColors.accent };
const lightPaint = { card: lightColors.surface, title: lightColors.ink, badge: lightColors.accent };

describe('theme', () => {
  it('seeds the palette from the device before anything renders, then applies the stored choice', async () => {
    expect(schemeAtImport).toBe('dark');
    await act(() => themeLoaded);
    expect(getThemeMode()).toBe('light');
    expect(getColorScheme()).toBe('light');
    expect(appearance.set).toEqual(['light']);
  });

  it('repaints a mounted themedStyles card and its text when the preference changes, without remounting', async () => {
    await render(<Card />);
    expect(paint()).toEqual(lightPaint);
    await act(() => setThemeMode('dark'));
    expect(paint()).toEqual(darkPaint);
    await act(() => setThemeMode('light'));
    expect(paint()).toEqual(lightPaint);
    expect(mounts).toBe(1);
  });

  it("in 'system' mode follows the device's change events, not the stale value read after clearing the override", async () => {
    await render(<Card />);
    // Forced « Clair » on a dark phone: RN still reports 'light' right after the override is cleared.
    appearance.native = 'light';
    await act(() => setThemeMode('system'));
    expect(appearance.set.at(-1)).toBe('unspecified');
    expect(getColorScheme()).toBe('light');
    await emitSystem('dark'); // the trait change iOS posts once the override is gone
    expect(paint()).toEqual(darkPaint);
    await emitSystem('light');
    expect(paint()).toEqual(lightPaint);
  });

  it('ignores system changes while forced, and defers those that arrive in the background', async () => {
    await render(<Card />);
    await act(() => setThemeMode('light'));
    await emitSystem('dark');
    expect(paint()).toEqual(lightPaint);

    await act(() => setThemeMode('system'));
    await emitSystem('dark');
    expect(paint()).toEqual(darkPaint);
    const onAppState = (AppState.addEventListener as jest.Mock).mock.calls.find(([type]) => type === 'change')![1] as (s: string) => void;
    const current = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true, writable: true });
    try {
      await emitSystem('light'); // app-switcher snapshot flip: ignored for now
      expect(paint()).toEqual(darkPaint);
    } finally {
      Object.defineProperty(AppState, 'currentState', current!);
    }
    await act(() => onAppState('active'));
    expect(paint()).toEqual(lightPaint);
  });
});

describe('theme guard', () => {
  /** Known violations. Keep it empty: fix the code instead of adding a line here. */
  const KNOWN: RegExp[] = [];

  it('finds no colour read at import, in a component without useTheme(), or cached in a hook', () => {
    const ts = require('typescript') as typeof import('typescript');
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../../..');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        if (f === 'node_modules' || f === '__tests__') continue;
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !f.endsWith('.d.ts')) files.push(p);
      }
    };
    ['packages/ui/src', 'apps/passenger/src', 'apps/driver/src'].forEach((d) => walk(path.join(root, d)));
    const CACHE_HOOKS = new Set(['useMemo', 'useCallback', 'useState', 'useRef', 'useReducer']);
    const nameOf = (fn: import('typescript').Node) => {
      if ((ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) && fn.name) return fn.name.text;
      let p = fn.parent;
      while (p && ts.isCallExpression(p)) p = p.parent; // memo(...), forwardRef(...)
      return p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : '';
    };
    const hasJsx = (n: import('typescript').Node): boolean => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n) || !!ts.forEachChild(n, (c) => hasJsx(c) || undefined);
    const found: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (!/colors\.|colors\[|getColorScheme\(/.test(src)) continue;
      const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const where = (n: import('typescript').Node) => `${path.relative(root, file).split(path.sep).join('/')}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
      const check = (n: import('typescript').Node) => {
        const fns: import('typescript').Node[] = [];
        for (let child = n, p = n.parent; p; child = p, p = p.parent) {
          if (ts.isFunctionLike(p)) fns.push(p);
          if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && CACHE_HOOKS.has(p.expression.text) && p.arguments[0] === child) {
            const hook = p.expression.text;
            const deps = p.arguments[1]?.getText() ?? '';
            if ((hook !== 'useMemo' && hook !== 'useCallback') || !/scheme|theme|dark/i.test(deps)) found.push(`${where(n)} cached by ${hook}: ${n.getText()}`);
          }
        }
        if (fns.length === 0) return void found.push(`${where(n)} read at import: ${n.getText()}`);
        const component = fns.find((f) => /^[A-Z]/.test(nameOf(f)) && hasJsx(f));
        if (component && !/\buse\w*Theme\(\)/.test(component.getText())) found.push(`${where(n)} component ${nameOf(component)} reads colours without useTheme()`);
      };
      const visit = (n: import('typescript').Node) => {
        const isColors = (e: import('typescript').Expression) => ts.isIdentifier(e) && e.text === 'colors';
        if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && isColors(n.expression)) check(n);
        else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'getColorScheme') check(n);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(files.length).toBeGreaterThan(50);
    expect([...new Set(found)].filter((f) => !KNOWN.some((k) => k.test(f)))).toEqual([]);
  });
});
