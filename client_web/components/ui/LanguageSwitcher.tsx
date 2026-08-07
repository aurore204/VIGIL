'use client';

import { usePathname, Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '6px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '4px' : '4px 6px',
      }}
    >
      <Globe size={13} style={{ color: '#5A6577', flexShrink: 0 }} aria-hidden="true" />
      {!collapsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
          <Link
            href={pathname}
            locale="fr"
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
      )}
    </div>
  );
}