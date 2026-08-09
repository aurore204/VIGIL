'use client';

import { usePathname, Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LanguageSwitcher({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const locale = useLocale();
  const { token, setUser } = useAuthStore();
  const otherLocale = locale === 'fr' ? 'en' : 'fr';

  const persistLanguage = (newLocale: string) => {
    
    if (!token) return;
    api
      .updateProfile({ language: newLocale })
      .then(updatedUser => setUser(updatedUser))
      .catch(() => {
        
      });
  };

  if (collapsed) {
    return (
      <Link
        href={pathname}
        locale={otherLocale}
        onClick={() => persistLanguage(otherLocale)}
        title={otherLocale === 'en' ? 'Switch to English' : 'Passer en français'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          textDecoration: 'none',
          color: '#5A6577',
        }}
      >
        <Globe size={13} style={{ flexShrink: 0 }} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        justifyContent: 'flex-start',
        padding: '4px 6px',
      }}
    >
      <Globe size={13} style={{ color: '#5A6577', flexShrink: 0 }} aria-hidden="true" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
        <Link
          href={pathname}
          locale="fr"
          onClick={() => persistLanguage('fr')}
          style={{
            color: locale === 'fr' ? '#9DC0F0' : '#5A6577',
            textDecoration: 'none',
            padding: '2px 4px',
            borderRadius: '4px',
            background: locale === 'fr' ? '#182238' : 'transparent',
          }}
        >
          FR
        </Link>
        <Link
          href={pathname}
          locale="en"
          onClick={() => persistLanguage('en')}
          style={{
            color: locale === 'en' ? '#9DC0F0' : '#5A6577',
            textDecoration: 'none',
            padding: '2px 4px',
            borderRadius: '4px',
            background: locale === 'en' ? '#182238' : 'transparent',
          }}
        >
          EN
        </Link>
      </div>
    </div>
  );
}