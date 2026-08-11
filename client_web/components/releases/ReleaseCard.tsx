import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ReleaseStateBadge } from '@/components/ui/Badge';
import { shadow } from '@/lib/tokens';
import type { Release } from '@/lib/types';
import { Users, ArrowRight } from 'lucide-react';

interface ReleaseCardProps {
  release: Release;
  teamName: string;
}

export function ReleaseCard({ release, teamName }: ReleaseCardProps) {
  const t = useTranslations('releases.card');
  const validatedCount = release.steps.filter(s => s.state === 'completed').length;
  const totalSteps = release.steps.length;

  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '14px',
      padding: '24px',
      boxShadow: shadow.card,
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      minWidth: 0,
    }}>
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '10px', marginBottom: '12px',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '14px',
            background: 'oklch(0.22 0.02 260)', border: '1px solid oklch(0.32 0.02 260)',
            fontSize: '11.5px', fontWeight: 600, color: 'oklch(0.72 0.01 260)',
            minWidth: 0, overflow: 'hidden',
          }}>
            <Users size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamName}</span>
          </div>
          <ReleaseStateBadge state={release.state} />
        </div>

        <div style={{
          fontSize: '17px', fontWeight: 700, color: 'oklch(0.95 0.005 260)',
          lineHeight: 1.3, marginBottom: '6px',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {release.title}
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '2px 8px', borderRadius: '6px',
          background: 'oklch(0.16 0.015 260)',
          fontSize: '11px', fontWeight: 600, color: 'oklch(0.58 0.012 260)',
          fontFamily: 'ui-monospace, monospace',
        }}>
          {validatedCount}/{totalSteps} {t('steps')}
        </div>
      </div>

      {totalSteps > 0 && (
        <div>
          <div style={{ display: 'flex', gap: '3px', height: '7px', borderRadius: '4px', overflow: 'hidden', background: 'oklch(0.16 0.015 260)' }}>
            {release.steps.map(step => (
              <div
                key={step.id}
                style={{
                  flex: 1,
                  background: step.state === 'completed'
                    ? 'oklch(0.72 0.14 150)'
                    : step.state === 'cancelled'
                    ? 'oklch(0.78 0.14 25)'
                    : 'oklch(0.30 0.02 260)',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>
            <span>{release.steps[0]?.name}</span>
            {totalSteps > 1 && <span>{release.steps[totalSteps - 1]?.name}</span>}
          </div>
        </div>
      )}

      <Link href={`/releases/${release.id}`} style={{ textDecoration: 'none', marginTop: 'auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
          padding: '11px', borderRadius: '9px',
          border: '1px solid oklch(0.34 0.02 260)', fontSize: '13px', fontWeight: 600,
          color: 'oklch(0.90 0.005 260)',
        }}>
          {t('view')}
          <ArrowRight size={14} aria-hidden="true" />
        </div>
      </Link>
    </div>
  );
}