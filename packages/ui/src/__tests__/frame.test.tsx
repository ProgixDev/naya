// Native-only modules pulled in by Screen: their published jest mocks.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { lightColors } from '@naya/tokens';
import { Button } from '../Button';
import { Header } from '../Header';
import { IconDisc, ListGroup, ListRow } from '../List';
import { Screen } from '../Screen';
import { Sheet } from '../BottomSheet';
import { FormField, PickerField } from '../Form';
import { ProfileHero } from '../ProfileHero';

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: ReactNode) => <SafeAreaProvider initialMetrics={safeArea}>{ui}</SafeAreaProvider>;

describe('ListRow (X-08)', () => {
  it('draws a choice with a check and radio semantics, never a chevron', async () => {
    const onPress = jest.fn();
    await render(
      <ListGroup>
        <ListRow title="Rabat" selected onPress={onPress} testID="city-rabat" />
        <ListRow title="Casablanca" selected={false} onPress={onPress} testID="city-casa" />
      </ListGroup>,
    );
    const rabat = screen.getByTestId('city-rabat');
    expect(rabat.props.accessibilityRole).toBe('radio');
    expect(rabat.props.accessibilityState).toMatchObject({ selected: true, checked: true });
    expect(screen.getByTestId('city-casa').props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(rabat);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reads the row state once, in the row label (R1)', async () => {
    await render(<ListRow title="Permis de conduire" status={{ kind: 'document', state: 'in_review' }} onPress={() => {}} testID="doc" />);
    const label = screen.getByTestId('doc').props.accessibilityLabel as string;
    expect(label.startsWith('Permis de conduire, ')).toBe(true);
    expect(label.length).toBeGreaterThan('Permis de conduire, '.length);
  });

  it('keeps the chevron for navigation rows', async () => {
    await render(<ListRow title="Préférences" onPress={() => {}} testID="nav" />);
    expect(screen.getByTestId('nav').props.accessibilityRole).toBe('button');
  });
});

describe('IconDisc (§5.4)', () => {
  it('snaps retired sizes to 40, 44 or 56', async () => {
    await render(
      <>
        <IconDisc size={36} testID="a"><RNText>a</RNText></IconDisc>
        <IconDisc size={52} testID="b"><RNText>b</RNText></IconDisc>
      </>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('a').props.style).width).toBe(40);
    expect(StyleSheet.flatten(screen.getByTestId('b').props.style).width).toBe(56);
  });
});

describe('Button disabled (X-07)', () => {
  it('uses the neutral fill, no plum, and stays inert', async () => {
    const onPress = jest.fn();
    await render(<Button label="Vérifier" disabled onPress={onPress} testID="b" />);
    const b = screen.getByTestId('b');
    expect(StyleSheet.flatten(b.props.style).backgroundColor).toBe(lightColors.disabledFill);
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps a disabled ghost as text', async () => {
    await render(<Button label="Plus tard" variant="ghost" disabled testID="g" />);
    expect(StyleSheet.flatten(screen.getByTestId('g').props.style).backgroundColor).toBeUndefined();
  });
});

describe('Screen frame', () => {
  it('insets a tab screen so the last row clears the floating bar (X-04)', async () => {
    await render(wrap(<Screen tabBar testID="s"><RNText>Se déconnecter</RNText></Screen>));
    const sv = screen.getByTestId('s-scroll');
    // bar top = max(34, 12) + 60; inset = bar top + 16, plus up to 10 more with Dynamic Type (jest's fontScale is 2).
    expect(StyleSheet.flatten(sv.props.contentContainerStyle).paddingBottom).toBe(34 + 60 + 16 + 10);
  });

  it('scrolls the large title with the content and collapses it into the bar (X-05)', async () => {
    await render(wrap(<Screen header={<Header title="Mon compte" />} testID="s"><RNText>Contenu</RNText></Screen>));
    const all = () => screen.getAllByText('Mon compte', { includeHiddenElements: true });
    expect(all()).toHaveLength(1);
    await act(async () => {
      fireEvent(screen.getByTestId('header-large-title'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 66 } } });
    });
    const sv = screen.getByTestId('s-scroll');
    await act(async () => {
      fireEvent.scroll(sv, { nativeEvent: { contentOffset: { x: 0, y: 120 }, contentSize: { width: 390, height: 2000 }, layoutMeasurement: { width: 390, height: 844 } } });
    });
    // The compact echo appears in the bar; the large title stays the one header for screen readers.
    expect(all()).toHaveLength(2);
    expect(screen.getAllByRole('header', { name: 'Mon compte' })).toHaveLength(1);
    await act(async () => {
      fireEvent.scroll(sv, { nativeEvent: { contentOffset: { x: 0, y: 0 }, contentSize: { width: 390, height: 2000 }, layoutMeasurement: { width: 390, height: 844 } } });
    });
    expect(all()).toHaveLength(1);
  });

  it('keeps a compact header as it was', async () => {
    await render(wrap(<Screen header={<Header title="Paiement" large={false} onBack={() => {}} />}><RNText>Contenu</RNText></Screen>));
    expect(screen.getByRole('header', { name: 'Paiement' })).toBeTruthy();
    expect(screen.getByTestId('header-back')).toBeTruthy();
  });
});

describe('Sheet (UI-22)', () => {
  it('scrolls its body when it is taller than the cap', async () => {
    await render(wrap(<Sheet visible onClose={() => {}} title="Paiement" testID="sheet"><RNText>Contenu</RNText></Sheet>));
    expect(screen.getByTestId('sheet-body')).toHaveTextContent('Contenu');
    expect(screen.getByTestId('sheet-close')).toBeTruthy();
  });
});

describe('Fields (X-09, §5.8)', () => {
  it('shows an example under the field and reads it as a hint', async () => {
    await render(<FormField label="Numéro du permis" example="Ex. : 12/345678" value="" onChangeText={() => {}} testID="f" />);
    expect(screen.getByText('Ex. : 12/345678', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('f').props.accessibilityHint).toBe('Ex. : 12/345678');
  });

  it('opens a choice from a picker field', async () => {
    const onPress = jest.fn();
    await render(<PickerField label="Ville" value="Rabat" onPress={onPress} testID="p" />);
    expect(screen.getByTestId('p').props.accessibilityLabel).toBe('Ville, Rabat');
    await fireEvent.press(screen.getByTestId('p'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ProfileHero', () => {
  it('shows the verified seal beside the name and reads it (A80)', async () => {
    await render(<ProfileHero name="Salma El Mansouri" detail="Rabat" verified />);
    expect(screen.getByLabelText('Salma El Mansouri, compte vérifié')).toBeTruthy();
    expect(screen.getByTestId('profile-verified')).toBeTruthy();
  });
});
