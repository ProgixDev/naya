import type { VerificationItemKey } from '@naya/domain';

export const PASSENGER_STEPS: { key: VerificationItemKey; title: string; guidance: string; selfie?: boolean }[] = [
  { key: 'selfie', title: 'Votre selfie', guidance: 'Visage dégagé, bien éclairé, sans lunettes de soleil. Il sert uniquement à comparer avec votre pièce.', selfie: true },
  { key: 'id_front', title: 'Pièce d’identité · recto', guidance: 'Posez la pièce à plat. Les quatre coins et le texte doivent être visibles, sans reflet.' },
  { key: 'id_back', title: 'Pièce d’identité · verso', guidance: 'Retournez la pièce et reprenez la même photo côté verso.' },
];

export const nextStep = (key: VerificationItemKey) => {
  const i = PASSENGER_STEPS.findIndex((s) => s.key === key);
  return PASSENGER_STEPS[i + 1]?.key ?? null;
};
