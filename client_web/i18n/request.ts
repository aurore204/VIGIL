import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

<<<<<<< HEAD
  const [nav, auth, dashboard, incidents, releases, rules, teams ,messages,profile] = await Promise.all([
=======
  const [nav, auth, dashboard, incidents, releases, rules, teams ,messages ,profile] = await Promise.all([
>>>>>>> 0bb8fb4 (feat(profile): add de la gestion du profil utilisateur)
    import(`../locales/${locale}/nav.json`),
    import(`../locales/${locale}/auth.json`),
    import(`../locales/${locale}/dashboard.json`),
    import(`../locales/${locale}/incidents.json`),
    import(`../locales/${locale}/releases.json`),
    import(`../locales/${locale}/rules.json`),
    import(`../locales/${locale}/teams.json`),
    import(`../locales/${locale}/messages.json`),
    import(`../locales/${locale}/profile.json`),
  ]);

  return {
    locale,
    messages: {
      ...nav.default,
      auth: auth.default,
      dashboard: dashboard.default,
      incidents: incidents.default,
      releases: releases.default,
      rules: rules.default,
      teams: teams.default,
      messages: messages.default,
      profile: profile.default,
    },
  };
});