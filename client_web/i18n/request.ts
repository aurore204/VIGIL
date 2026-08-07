import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const [nav, auth, dashboard] = await Promise.all([
    import(`../locales/${locale}/nav.json`),
    import(`../locales/${locale}/auth.json`),
    import(`../locales/${locale}/dashboard.json`),
  ]);

  return {
    locale,
    messages: {
      ...nav.default,
      auth: auth.default,
      dashboard: dashboard.default,
    },
  };
});