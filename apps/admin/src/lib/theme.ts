import { useEffect, useState } from 'react';

/** Admin colour scheme: light, dark, or follow the system. Stored per browser. */
export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'naya-admin-theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#16121A' : '#F8F7F9');
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);
  useEffect(() => {
    apply(choice);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      /* private mode: the choice lasts for this tab only */
    }
    if (choice !== 'system') return;
    const m = media();
    const onChange = () => apply('system');
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [choice]);
  return [choice, setChoice] as const;
}
