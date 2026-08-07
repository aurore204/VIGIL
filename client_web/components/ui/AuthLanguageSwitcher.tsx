'use client';

import { usePathname, Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';

export default function AuthLanguageSwitcher() {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        justifyContent: 'flex-end',
        width: '100%',
        maxWidth: '360px',
        marginBottom: '16px',
      }}
    >
      <Globe size={13} style={{ color: 'oklch(0.55 0.01 260)', flexShrink: 0 }} aria-hidden="true" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
        <Link
          href={pathname}
          locale="fr"
          style={{
            color: locale === 'fr' ? 'oklch(0.85 0.10 255)' : 'oklch(0.55 0.01 260)',
            textDecoration: 'none',
            padding: '3px 6px',
            borderRadius: '5px',
            background: locale === 'fr' ? 'oklch(0.28 0.05 255)' : 'transparent',
          }}
        >
          FR
        </Link>
        <Link
          href={pathname}
          locale="en"
          style={{
            color: locale === 'en' ? 'oklch(0.85 0.10 255)' : 'oklch(0.55 0.01 260)',
            textDecoration: 'none',
            padding: '3px 6px',
            borderRadius: '5px',
            background: locale === 'en' ? 'oklch(0.28 0.05 255)' : 'transparent',
          }}
        >
          EN
        </Link>
      </div>
    </div>
  );
}