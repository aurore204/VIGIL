'use client';

import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';

interface PresenceIndicatorProps {
  watchers: string[];
}

export function PresenceIndicator({ watchers }: PresenceIndicatorProps) {
  const uniqueWatchers = Array.from(new Set(watchers));
  const t = useTranslations('incidents.presence');

  return (
    <div style={{
      background: 'oklch(0.20 0.016 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '14px',
      padding: '14px 20px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      boxShadow: '0 4px 20px oklch(0 0 0 / 0.25)',
      gap: '14px',
      flexWrap: 'wrap',
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.04em', color: 'oklch(0.55 0.01 260)', flexShrink: 0,
      }}>
        <Eye size={13} aria-hidden="true" />
        {t('title')}
      </span>
      {watchers.length === 0 ? (
        <span style={{ fontSize: '12.5px', color: 'oklch(0.42 0.01 260)', fontStyle: 'italic' }}>
          {t('empty')}
        </span>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {uniqueWatchers.map(username => (
            <div key={username} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 11px 4px 4px', borderRadius: '20px',
              background: 'oklch(0.24 0.025 260)', border: '1px solid oklch(0.32 0.02 260)',
            }}>
              <div style={{
                width: '19px', height: '19px', borderRadius: '50%',
                background: 'oklch(0.30 0.03 255)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', fontWeight: 700, color: 'oklch(0.85 0.05 255)', flexShrink: 0,
              }}>
                {username.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: '12.5px', color: 'oklch(0.88 0.005 260)', fontWeight: 500 }}>
                {username}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}