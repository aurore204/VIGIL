import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'VIGIL',
  description: 'Plateforme de contrôle opérationnel collaboratif',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{
        margin: 0,
        padding: 0,
        background: 'oklch(0.16 0.015 260)',
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: '13px',
      }}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}