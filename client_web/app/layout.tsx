import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VIGIL',
  description: 'Plateforme de contrôle opérationnel collaboratif',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, background: 'oklch(0.16 0.015 260)' }} className={inter.className}>
         <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}