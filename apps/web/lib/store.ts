'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RideStatus = 'En cours' | 'Terminée' | 'Planifiée' | 'Annulée';
export type Ride = {
  id: string;
  passenger: string;
  driver: string;
  from: string;
  to: string;
  amount: number;
  status: RideStatus;
  time: string;
  method: string;
  city: string;
  date: string;
  cancellationReason?: string;
};
export type DocumentStatus = 'À examiner' | 'Accepté' | 'À compléter';
export const documentLabels = {
  identity: 'Pièce d’identité',
  license: 'Permis de conduire',
  vehicle: 'Assurance et carte grise',
};
export type DocumentKey = keyof typeof documentLabels;
export type Driver = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  status: 'En ligne' | 'Hors ligne' | 'À vérifier' | 'Refusée';
  rating: number;
  rides: number;
  city: string;
  createdAt?: string;
  rejectionReason?: string;
  documents?: Partial<Record<DocumentKey, DocumentStatus>>;
};
export type Ticket = {
  id: string;
  name: string;
  subject: string;
  priority: string;
  status: 'Ouvert' | 'En cours' | 'Résolu';
  message: string;
  reply?: string;
  city?: string;
  createdAt?: string;
  assignee?: string;
  responses?: { body: string; date: string }[];
};
export const initialRides: Ride[] = [
  {
    id: 'NY-1048',
    passenger: 'Salma El Mansouri',
    driver: 'Amina Bennani',
    from: 'Agdal, avenue de France',
    to: 'Hay Riad, Mahaj Riad',
    amount: 65,
    status: 'En cours',
    time: '14:32',
    method: 'Carte',
    city: 'Rabat',
    date: '2026-10-05',
  },
  {
    id: 'NY-1047',
    passenger: 'Nour Benali',
    driver: 'Nadia Chraibi',
    from: 'Hassan, place du 16 Novembre',
    to: 'Agdal, gare Rabat Agdal',
    amount: 42,
    status: 'En cours',
    time: '14:28',
    method: 'Espèces',
    city: 'Rabat',
    date: '2026-10-05',
  },
  {
    id: 'NY-1046',
    passenger: 'Imane Tazi',
    driver: 'Khadija Idrissi',
    from: 'Souissi, avenue Mohammed VI',
    to: 'Océan, rue de Londres',
    amount: 78,
    status: 'Terminée',
    time: '14:15',
    method: 'Carte',
    city: 'Rabat',
    date: '2026-10-05',
  },
  {
    id: 'NY-1045',
    passenger: 'Rania Alaoui',
    driver: 'Amina Bennani',
    from: 'Hay Riad, centre commercial',
    to: 'Hassan, tour Hassan',
    amount: 58,
    status: 'Terminée',
    time: '13:54',
    method: 'Carte',
    city: 'Rabat',
    date: '2026-10-05',
  },
  {
    id: 'NY-1044',
    passenger: 'Hiba El Fassi',
    driver: 'Samira Fassi',
    from: 'Agdal, avenue Fal Ould Oumeir',
    to: 'Souissi, clinique internationale',
    amount: 55,
    status: 'Planifiée',
    time: '16:00',
    method: 'Carte',
    city: 'Rabat',
    date: '2026-10-05',
  },
  {
    id: 'NY-1043',
    passenger: 'Lina Berrada',
    driver: 'Nadia Chraibi',
    from: 'Médina, Bab El Had',
    to: 'Agdal, avenue de France',
    amount: 38,
    status: 'Annulée',
    time: '13:28',
    method: 'Espèces',
    city: 'Rabat',
    date: '2026-10-05',
  },
  {
    id: 'NY-1042',
    passenger: 'Aya Idrissi',
    driver: 'Khadija Idrissi',
    from: 'Hassan, gare Rabat Ville',
    to: 'Hay Riad, avenue Annakhil',
    amount: 72,
    status: 'Terminée',
    time: '13:12',
    method: 'Carte',
    city: 'Rabat',
    date: '2026-10-05',
  },
  {
    id: 'NY-1041',
    passenger: 'Meryem Bennis',
    driver: 'Samira Fassi',
    from: 'Agdal, université Mohammed V',
    to: 'Hassan, avenue Al Alaouiyine',
    amount: 46,
    status: 'Terminée',
    time: '12:58',
    method: 'Espèces',
    city: 'Rabat',
    date: '2026-10-05',
  },
  {
    id: 'NY-1040',
    passenger: 'Sara Amrani',
    driver: 'Nadia Chraibi',
    from: 'Souissi, avenue des Nations Unies',
    to: 'Agdal, gare Rabat Agdal',
    amount: 52,
    status: 'Terminée',
    time: '12:43',
    method: 'Carte',
    city: 'Rabat',
    date: '2026-10-04',
  },
  {
    id: 'NY-1039',
    passenger: 'Yasmine Tazi',
    driver: 'Amina Bennani',
    from: 'Hassan, tour Hassan',
    to: 'Océan, avenue du Liban',
    amount: 44,
    status: 'Terminée',
    time: '12:30',
    method: 'Espèces',
    city: 'Rabat',
    date: '2026-10-04',
  },
];
const initialDrivers: Driver[] = [
  {
    id: 'CH-001',
    name: 'Amina Bennani',
    phone: '+212 6 61 23 45 67',
    vehicle: 'Naya Signature · Pearl',
    plate: '12345-A-1',
    status: 'En ligne',
    rating: 4.98,
    rides: 248,
    city: 'Rabat',
  },
  {
    id: 'CH-002',
    name: 'Nadia Chraibi',
    phone: '+212 6 63 45 67 89',
    vehicle: 'Peugeot 208',
    plate: '48217-A-1',
    status: 'En ligne',
    rating: 4.92,
    rides: 186,
    city: 'Rabat',
  },
  {
    id: 'CH-003',
    name: 'Khadija Idrissi',
    phone: '+212 6 62 34 56 78',
    vehicle: 'Dacia Sandero',
    plate: '87312-B-1',
    status: 'En ligne',
    rating: 4.95,
    rides: 142,
    city: 'Rabat',
  },
  {
    id: 'CH-004',
    name: 'Samira Fassi',
    phone: '+212 6 65 67 89 01',
    vehicle: 'Renault Clio',
    plate: '26543-A-1',
    status: 'Hors ligne',
    rating: 4.89,
    rides: 98,
    city: 'Rabat',
  },
  {
    id: 'CH-005',
    name: 'Leila Amrani',
    phone: '+212 6 64 56 78 90',
    vehicle: 'Hyundai i20',
    plate: '75218-B-1',
    status: 'À vérifier',
    rating: 0,
    rides: 0,
    city: 'Rabat',
  },
  {
    id: 'CH-006',
    name: 'Sofia El Alami',
    phone: '+212 6 71 82 93 04',
    vehicle: 'Toyota Yaris',
    plate: '65829-A-1',
    status: 'À vérifier',
    rating: 0,
    rides: 0,
    city: 'Rabat',
  },
  {
    id: 'CH-007',
    name: 'Hajar Benjelloun',
    phone: '+212 6 82 93 04 15',
    vehicle: 'Kia Picanto',
    plate: '91827-A-1',
    status: 'À vérifier',
    rating: 0,
    rides: 0,
    city: 'Rabat',
  },
];
export type Audit = { id: string; action: string; date: string };
type State = {
  rides: Ride[];
  drivers: Driver[];
  tickets: Ticket[];
  audit: Audit[];
  notificationsRead: boolean;
  commission: number;
  city: string;
  serviceOpen: boolean;
  toast: string | null;
  notify: (message: string | null) => void;
  addRide: (ride: Omit<Ride, 'id' | 'date'> & { date?: string }) => string;
  updateRide: (id: string, status: RideStatus, reason?: string) => void;
  addDriver: (driver: Pick<Driver, 'name' | 'phone' | 'vehicle'>) => void;
  verifyDriver: (id: string, approve: boolean, reason?: string) => void;
  reviewDocument: (id: string, key: DocumentKey, status: DocumentStatus) => void;
  setDriverOnline: (id: string, online: boolean) => void;
  replyTicket: (id: string, reply: string) => void;
  resolveTicket: (id: string) => void;
  updateTicket: (id: string, changes: Pick<Partial<Ticket>, 'assignee' | 'priority'>) => void;
  readNotifications: () => void;
  saveSettings: (commission: number, serviceOpen: boolean) => void;
  setCity: (city: string) => void;
};
const event = (action: string): Audit => ({
  id: crypto.randomUUID(),
  action,
  date: new Date().toISOString(),
});
export const useNaya = create<State>()(
  persist(
    (set, get) => ({
      rides: initialRides,
      drivers: initialDrivers,
      tickets: [
        {
          id: 'SUP-024',
          name: 'Nour Benali',
          subject: 'Objet oublié dans le véhicule',
          priority: 'Normale',
          status: 'Ouvert',
          message:
            'Bonjour, j’ai oublié mon écharpe dans la voiture après ma course NY-1047. Pourriez-vous contacter ma chauffeuse ? Merci !',
        },
        {
          id: 'SUP-023',
          name: 'Imane Tazi',
          subject: 'Question sur mon paiement',
          priority: 'Haute',
          status: 'Ouvert',
          message:
            'Mon paiement apparaît deux fois sur mon relevé. Pouvez-vous vérifier la course NY-1046 ?',
        },
        {
          id: 'SUP-022',
          name: 'Rania Alaoui',
          subject: 'Modifier ma réservation',
          priority: 'Normale',
          status: 'Ouvert',
          message: 'Je souhaite décaler ma réservation de demain de 30 minutes.',
        },
      ],
      audit: [],
      notificationsRead: false,
      commission: 15,
      city: 'Rabat',
      serviceOpen: true,
      toast: null,
      notify: (toast) => set({ toast }),
      addRide: (ride) => {
        const id = `NY-${Math.max(1048, ...get().rides.map((r) => Number(r.id.split('-')[1]))) + 1}`;
        set((s) => ({
          rides: [
            {
              ...ride,
              id,
              date:
                ride.date ??
                new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' }),
            },
            ...s.rides,
          ],
          audit: [event(`Course ${id} créée`), ...s.audit],
        }));
        return id;
      },
      updateRide: (id, status, reason) =>
        set((s) => ({
          rides: s.rides.map((r) =>
            r.id === id ? { ...r, status, ...(reason ? { cancellationReason: reason } : {}) } : r,
          ),
          audit: [event(`${id} · ${status}${reason ? ` · Motif : ${reason}` : ''}`), ...s.audit],
          toast: `Course ${id} : ${status.toLowerCase()}`,
        })),
      addDriver: (driver) =>
        set((s) => ({
          drivers: [
            ...s.drivers,
            {
              ...driver,
              id: `CH-${Date.now()}`,
              plate: 'À renseigner',
              status: 'À vérifier',
              rating: 0,
              rides: 0,
              city: 'Rabat',
              createdAt: new Date().toISOString(),
              documents: {},
            },
          ],
          audit: [event(`Candidature de ${driver.name} reçue`), ...s.audit],
        })),
      verifyDriver: (id, approve, reason) => {
        const driver = get().drivers.find((d) => d.id === id);
        if (
          approve &&
          (!driver ||
            Object.keys(documentLabels).some(
              (key) => driver.documents?.[key as DocumentKey] !== 'Accepté',
            ))
        ) {
          set({ toast: 'Examinez et acceptez les trois documents avant de valider le dossier.' });
          return;
        }
        set((s) => ({
          drivers: s.drivers.map((d) =>
            d.id === id
              ? { ...d, status: approve ? 'Hors ligne' : 'Refusée', rejectionReason: reason }
              : d,
          ),
          audit: [
            event(
              `Dossier ${id} ${approve ? 'validé' : `refusé · Motif : ${reason ?? 'Non précisé'}`}`,
            ),
            ...s.audit,
          ],
          toast: approve
            ? 'Dossier validé. La chauffeuse peut maintenant se connecter.'
            : 'Dossier refusé.',
        }));
      },
      reviewDocument: (id, key, status) =>
        set((s) => ({
          drivers: s.drivers.map((d) =>
            d.id === id ? { ...d, documents: { ...d.documents, [key]: status } } : d,
          ),
          audit: [event(`${id} · ${documentLabels[key]} : ${status}`), ...s.audit],
        })),
      setDriverOnline: (id, online) =>
        set((s) => ({
          drivers: s.drivers.map((d) =>
            d.id === id ? { ...d, status: online ? 'En ligne' : 'Hors ligne' } : d,
          ),
          audit: [event(`Disponibilité de ${id} modifiée`), ...s.audit],
          toast: 'Disponibilité mise à jour',
        })),
      replyTicket: (id, reply) =>
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === id
              ? {
                  ...t,
                  reply,
                  status: 'En cours',
                  responses: [
                    ...(t.responses ?? (t.reply ? [{ body: t.reply, date: '' }] : [])),
                    { body: reply, date: new Date().toISOString() },
                  ],
                }
              : t,
          ),
          audit: [event(`Réponse à ${id} enregistrée`), ...s.audit],
          toast: 'Réponse enregistrée. La demande reste en cours.',
        })),
      resolveTicket: (id) =>
        set((s) => ({
          tickets: s.tickets.map((t) => (t.id === id ? { ...t, status: 'Résolu' } : t)),
          audit: [event(`Demande ${id} résolue`), ...s.audit],
          toast: 'Demande marquée comme résolue.',
        })),
      updateTicket: (id, changes) =>
        set((s) => ({
          tickets: s.tickets.map((t) => (t.id === id ? { ...t, ...changes } : t)),
          audit: [
            event(
              `${id} · ${changes.assignee !== undefined ? `Attribution : ${changes.assignee}` : `Priorité : ${changes.priority}`}`,
            ),
            ...s.audit,
          ],
        })),
      readNotifications: () => set({ notificationsRead: true }),
      saveSettings: (commission, serviceOpen) =>
        set((s) => ({
          commission,
          serviceOpen,
          audit: [event('Paramètres de service mis à jour'), ...s.audit],
          toast: 'Vos modifications ont été enregistrées',
        })),
      setCity: (city) => set({ city }),
    }),
    {
      name: 'naya-web-prototype-v1',
      partialize: ({ toast, notify, ...s }) => s,
      skipHydration: true,
    },
  ),
);

export const money = (value: number) =>
  new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(value) + ' MAD';
