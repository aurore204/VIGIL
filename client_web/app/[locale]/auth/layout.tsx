'use client';

import { useTranslations } from 'next-intl';
import AuthLanguageSwitcher from '@/components/ui/AuthLanguageSwitcher';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'oklch(0.16 0.015 260)',
      color: 'oklch(0.95 0.005 260)',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Panneau gauche */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px',
        background: 'linear-gradient(160deg, oklch(0.20 0.03 255), oklch(0.14 0.02 260))',
        borderRight: '1px solid oklch(0.34 0.02 260)'
      }}>
        {/* Logo */}
        <img
          src="/vigil-logo.png"
          alt="VIGIL"
          width={156}
          height={56}
          style={{ borderRadius: '14px', flexShrink: 0, display: 'block' }}
        />

        {/* Tagline */}
        <div>
          <div style={{ fontSize: '34px', fontWeight: 800, lineHeight: 1.15, maxWidth: '420px' }}>
            {t('tagline.title')}
          </div>
          <div style={{ marginTop: '14px', fontSize: '15px', color: 'oklch(0.72 0.01 260)', maxWidth: '400px' }}>
            {t('tagline.subtitle')}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '24px',
          fontSize: '12px', fontFamily: 'ui-monospace, monospace',
          color: 'oklch(0.52 0.012 260)'
        }}>

        </div>
      </div>

      {/* Panneau droit */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px', position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
          <AuthLanguageSwitcher />
        </div>
        {children}
      </div>
    </div>
  );
}