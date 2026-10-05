import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import './refinements.css';
import { Toast } from '@/components/ui';

export const metadata: Metadata = {
  title: { default: 'Naya — Votre ville. Votre liberté.', template: '%s · Naya' },
  description:
    'La mobilité entre femmes, pensée pour vous. Découvrez Naya à Rabat et voyagez en toute sérénité.',
  icons: { icon: '/images/symbol.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Toast />
      </body>
    </html>
  );
}
