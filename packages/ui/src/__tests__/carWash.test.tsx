// Native-only modules pulled in by Screen and the map: their published jest mocks.
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('../map', () => ({ NayaMap: () => null }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { mad, PLACES, type WashOrder } from '@naya/domain';
import type { ApiClient } from '@naya/api';
import { ApiProvider } from '@naya/api/react';
import { CarWashEntry, CarWashOrderScreen } from '../features/carWash';

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

const at = (min: number) => new Date(Date.parse('2026-10-01T08:00:00Z') + min * 60_000).toISOString();
const order: WashOrder = {
  id: 'LV-001',
  cityId: 'rabat',
  customerId: 'U-1',
  customerRole: 'passenger',
  customerFirstName: 'Salma',
  location: PLACES.agdal,
  parkingNotes: 'Sous-sol −1, place 42',
  car: { make: 'Dacia', model: 'Sandero', color: 'Gris', plate: '12345-A-6' },
  vehicleId: null,
  terms: { cityId: 'rabat', rulesVersion: 1, packageId: 'exterior', packageName: 'Extérieur', includes: ['Jantes et pneus'], durationMinutes: 45, price: mad(60), commissionBp: 2000, cancellation: { graceSeconds: 300, freeUntilMinutesBefore: 120, lateFee: mad(20), enRouteFee: mad(30) }, currency: 'MAD', acceptedAt: at(0) },
  timing: 'now',
  startAt: at(40),
  endAt: at(85),
  paymentMethod: { id: 'PM-1', kind: 'cash', label: 'Espèces' },
  paymentId: 'PY-1',
  status: 'completed',
  team: { id: 'WT-RBA-1', name: 'Équipe Lavage Agdal', ratingAverage: 4.9, vehicleLabel: 'Triporteur de lavage', phoneMasked: 'Appel masqué via Naya' },
  teamBase: null,
  teamLocation: null,
  photos: [
    { id: 'P1', stage: 'before', uploadId: null, label: 'Avant · carrosserie (photo simulée)', at: at(2) },
    { id: 'P2', stage: 'after', uploadId: null, label: 'Après · carrosserie (photo simulée)', at: at(5) },
  ],
  createdAt: at(0),
  assignedAt: at(1),
  departedAt: at(1),
  startedAt: at(2),
  completedAt: at(5),
  cancellation: null,
  rating: null,
  timeline: [],
  simulated: true,
};

const clients: QueryClient[] = [];
afterEach(() => {
  for (const qc of clients.splice(0)) qc.clear();
});

function renderWith(ui: ReactNode, api: Partial<ApiClient>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(qc);
  return render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <ApiProvider client={api as ApiClient}>
        <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
      </ApiProvider>
    </SafeAreaProvider>,
  );
}

describe('car wash', () => {
  it('home entry is one labelled button', async () => {
    const onPress = jest.fn();
    await render(<CarWashEntry onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('car-wash-entry'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Lavage à domicile/)).toBeTruthy();
  });

  it('a completed order shows every step, the photos, the receipt and the rating, and no cancel action', async () => {
    const api = { carWash: { get: jest.fn(async () => ({ order, payments: [{ id: 'PY-1', rideId: null, washOrderId: 'LV-001', payerId: 'U-1', purpose: 'car_wash' as const, method: 'cash' as const, amount: mad(60), status: 'confirmed' as const, provider: 'cash', providerRef: null, failureReason: null, createdAt: at(5), updatedAt: at(5) }] })) } } as unknown as Partial<ApiClient>;
    await renderWith(<CarWashOrderScreen accountId="U-1" orderId="LV-001" onBack={() => undefined} />, api);
    expect(await screen.findByTestId('car-wash-timeline')).toBeTruthy();
    for (const s of ['booked', 'washer_assigned', 'en_route', 'washing', 'completed']) expect(screen.getByTestId(`car-wash-step-${s}`)).toBeTruthy();
    expect(screen.getByTestId('car-wash-photos')).toBeTruthy();
    expect(screen.getByText('Reçu')).toBeTruthy();
    expect(screen.getByText('Confirmé')).toBeTruthy();
    expect(screen.getByTestId('car-wash-rating')).toBeTruthy();
    expect(screen.queryByTestId('car-wash-cancel')).toBeNull();
    await screen.unmount();
  });
});
