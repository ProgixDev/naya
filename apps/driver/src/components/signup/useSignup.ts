import { useMemo } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { qk, type MeResponse } from '@naya/api';
import { useApi } from '@naya/api/react';
import { casablancaToday, type SignupContext, type SignupSection, type SignupStep, type VerificationCase } from '@naya/domain';
import { useAccountId, useCases } from '@/lib/queries';

/** The three driver dossiers, the validation context and helpers shared by the sign-up screens. */
export function useSignup() {
  const api = useApi();
  const qc = useQueryClient();
  const a = useAccountId();
  const cases = useCases();
  const phone = cases.data?.user.phone ?? null;
  const ctx: SignupContext = useMemo(() => ({ today: casablancaToday(), ownPhone: phone }), [phone]);
  const caseOf = (section: SignupSection): VerificationCase | null => (section === 'person' ? cases.person : section === 'vehicle' ? cases.vehicle : cases.famille);

  /** Writes a returned case into the cached /me so the next screen sees it at once. */
  const store = (c: VerificationCase) => {
    qc.setQueryData<MeResponse>(qk.me(a), (old) => (old ? { ...old, cases: old.cases.some((x) => x.id === c.id) ? old.cases.map((x) => (x.id === c.id ? c : x)) : [...old.cases, c] } : old));
    qc.invalidateQueries({ queryKey: qk.me(a) });
  };

  /** The section's dossier, created on first use (vehicle and Famille are opened on demand). */
  const ensureCase = async (section: SignupSection): Promise<VerificationCase> => {
    const existing = caseOf(section);
    if (existing) return existing;
    const created = section === 'vehicle' ? await api.verification.ensureVehicleCase() : section === 'famille' ? await api.verification.ensureFamilleCase() : null;
    if (!created) throw new Error('Dossier introuvable');
    store(created);
    return created;
  };

  return { ...cases, ctx, caseOf, store, ensureCase };
}

export const goToStep = (step: SignupStep | null, mode: 'push' | 'replace' = 'push') => {
  if (!step) return router.replace('/docs/status');
  const target = { pathname: '/docs/step/[id]' as const, params: { id: step.id } };
  return mode === 'replace' ? router.replace(target) : router.push(target);
};
