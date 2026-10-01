import type { VerificationItemKey } from '@naya/domain';

export const PASSENGER_STEPS: { key: VerificationItemKey; title: string; guidance: string; selfie?: boolean }[] = [
  { key: 'selfie', title: 'Votre selfie', guidance: 'Visage dégagé et bien éclairé, sans lunettes de soleil.', selfie: true },
  { key: 'id_front', title: 'Pièce · recto', guidance: 'Pièce à plat, quatre coins visibles, sans reflet.' },
  { key: 'id_back', title: 'Pièce · verso', guidance: 'Retournez la pièce, même cadrage.' },
];

export const nextStep = (key: VerificationItemKey) => {
  const i = PASSENGER_STEPS.findIndex((s) => s.key === key);
  return PASSENGER_STEPS[i + 1]?.key ?? null;
};
