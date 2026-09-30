import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router';
import { adminLoginSchema, type AdminLogin } from '@naya/domain';
import { errorMessage } from '@naya/api';
import { useAuth } from '../lib/auth';
import { BrandMark } from '../components/Brand';
import { Banner, Button, Field, Input } from '../components/ui';

const DEMO = [
  { email: 'meryem@naya.demo', password: 'Naya-Admin-2026', label: 'Meryem · administratrice' },
  { email: 'youssra@naya.demo', password: 'Naya-Support-2026', label: 'Youssra · agente support' },
];

/** A00-session: separate administrator sign-in (never exposed in the mobile apps). */
export function LoginPage() {
  const { login, expired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setValue } = useForm<AdminLogin>({ resolver: zodResolver(adminLoginSchema), defaultValues: { email: '', password: '' } });
  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await login(v.email, v.password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-2">
          <BrandMark height={30} />
          <span className="rounded-full bg-mauve-soft px-2 py-0.5 text-[12px] font-semibold text-accent">Administration</span>
        </div>
        <div className="card p-8">
          <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.3px]">Connexion</h1>
          <p className="mt-1 text-[14px] text-muted">Accès réservé à l’équipe Naya. Chaque action est inscrite au journal d’audit.</p>
          <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
            {expired ? <Banner tone="warning" title="Session expirée">Reconnectez-vous pour continuer.</Banner> : null}
            {serverError ? <Banner tone="danger" title={serverError} /> : null}
            <Field label="Adresse e-mail" error={formState.errors.email?.message}>
              {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="username" {...register('email')} data-testid="email" />}
            </Field>
            <Field label="Mot de passe" error={formState.errors.password?.message}>
              {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="current-password" {...register('password')} data-testid="password" />}
            </Field>
            <Button type="submit" loading={formState.isSubmitting} className="mt-2 w-full" data-testid="login-submit">
              Se connecter
            </Button>
          </form>
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-line p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Comptes de démonstration</div>
          <div className="mt-2 flex flex-col gap-1">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                className="flex items-center justify-between rounded-xl px-2 py-2 text-left text-[13px] hover:bg-surface"
                onClick={() => {
                  setValue('email', d.email);
                  setValue('password', d.password);
                }}
              >
                <span className="font-medium">{d.label}</span>
                <span className="text-muted">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
