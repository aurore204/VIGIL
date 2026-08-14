import '@testing-library/jest-dom';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) {
      return `${key} ${JSON.stringify(values)}`;
    }
    return key;
  },
  useLocale: () => 'fr',
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
    number: (n: number) => String(n),
  }),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));