jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));

import { act, render, screen, within } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, DeviceEventEmitter, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfirmDialog, Sheet } from '../BottomSheet';
import { TOAST_DURATION_MS, ToastHost, toast, useToast } from '../Toast';

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: ReactNode) => (
  <SafeAreaProvider initialMetrics={safeArea}>
    {ui}
    <ToastHost />
  </SafeAreaProvider>
);

let setSheetOpen: (v: boolean) => void = () => undefined;
function SheetHarness({ initial }: { initial: boolean }) {
  const [open, setOpen] = useState(initial);
  setSheetOpen = setOpen;
  return (
    <Sheet visible={open} onClose={() => setOpen(false)} title="Ajouter une adresse" testID="sheet">
      <Text>Contenu</Text>
    </Sheet>
  );
}

type Node = ReturnType<typeof screen.getByText>;
const insideModal = (start: Node | null) => {
  let node = start;
  while (node && node.type !== 'Modal') node = node.parent;
  return node !== null;
};
/** Whether the pill is drawn inside a Modal (a sheet or dialog) rather than the root host. */
const inModal = (text: string) => insideModal(screen.getByText(text).parent);
const layers = () => screen.getAllByTestId('toast-layer', { includeHiddenElements: true });
/** aria-live reaches Android as accessibilityLiveRegion and the web as aria-live. */
const liveRegion = (node: Node) => node.props['aria-live'] ?? node.props.accessibilityLiveRegion;

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await act(() => useToast.getState().hide());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows a pill, announces it to VoiceOver once and hides it on its own', async () => {
    await render(wrap(null));
    await act(() => toast('Adresse enregistrée', 'success'));
    expect(screen.getAllByText('Adresse enregistrée')).toHaveLength(1);
    expect(AccessibilityInfo.announceForAccessibilityWithOptions).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.announceForAccessibilityWithOptions).toHaveBeenCalledWith('Adresse enregistrée', { queue: true });
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByText('Adresse enregistrée')).toBeNull();
  });

  it('keeps a live region mounted so Android reads the next message', async () => {
    await render(wrap(null));
    expect(liveRegion(screen.getByTestId('toast-layer', { includeHiddenElements: true }))).toBe('polite');
  });

  it('keeps the root live region mounted under an open sheet, so a toast raised as it closes is read', async () => {
    await render(wrap(<SheetHarness initial />));
    // Android ignores a live region that appears together with its text: the root one must already be there.
    const root = layers().filter((l) => !insideModal(l));
    expect(root).toHaveLength(1);
    expect(liveRegion(root[0]!)).toBe('polite');
    await act(() => {
      setSheetOpen(false);
      toast('Adresse enregistrée', 'success');
    });
    expect(layers()).toHaveLength(1);
    expect(within(layers()[0]!).getByText('Adresse enregistrée')).toBeTruthy();
  });

  it('lifts the pill above the iOS keyboard', async () => {
    await render(wrap(<SheetHarness initial />));
    await act(() => toast('Adresse hors zone', 'danger'));
    const bottom = () => StyleSheet.flatten(layers().find((l) => insideModal(l))!.props.style).paddingBottom;
    expect(bottom()).toBe(34 + 90);
    await act(() => DeviceEventEmitter.emit('keyboardWillShow', { endCoordinates: { height: 336, screenX: 0, screenY: 508, width: 390 } }));
    expect(bottom()).toBe(336 + 16);
    await act(() => DeviceEventEmitter.emit('keyboardWillHide', { endCoordinates: { height: 0, screenX: 0, screenY: 844, width: 390 } }));
    expect(bottom()).toBe(34 + 90);
  });

  it('renders above an open sheet, once, and returns to the root when the sheet closes', async () => {
    await render(wrap(<SheetHarness initial />));
    await act(() => toast('Adresse hors zone', 'danger'));
    expect(screen.getAllByText('Adresse hors zone')).toHaveLength(1);
    expect(inModal('Adresse hors zone')).toBe(true);
    await act(() => setSheetOpen(false));
    expect(screen.getAllByText('Adresse hors zone')).toHaveLength(1);
    expect(inModal('Adresse hors zone')).toBe(false);
  });

  it('renders above a confirmation dialog', async () => {
    await render(wrap(<ConfirmDialog visible title="Annuler la course ?" confirmLabel="Annuler la course" onConfirm={() => undefined} onCancel={() => undefined} testID="dialog" />));
    await act(() => toast('Impossible d’annuler pour le moment.', 'danger'));
    expect(screen.getAllByText('Impossible d’annuler pour le moment.')).toHaveLength(1);
    expect(inModal('Impossible d’annuler pour le moment.')).toBe(true);
  });

  it('restarts the timer for a newer message', async () => {
    await render(wrap(null));
    await act(() => toast('Premier'));
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 500));
    await act(() => toast('Second'));
    await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - 500));
    expect(screen.getByText('Second')).toBeTruthy();
    await act(() => jest.advanceTimersByTime(500));
    expect(screen.queryByText('Second')).toBeNull();
  });
});
