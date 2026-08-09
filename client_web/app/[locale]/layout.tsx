import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale, getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ToastProvider } from '@/components/ui/Toast';
import '../globals.css';

export const metadata: Metadata = {
  title: 'VIGIL',
  description: 'Plateforme de contrôle opérationnel collaboratif',
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body style={{
        margin: 0,
        padding: 0,
        background: 'oklch(0.16 0.015 260)',
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: '13px',
      }}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}