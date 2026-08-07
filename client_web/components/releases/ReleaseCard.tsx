import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ReleaseStateBadge } from '@/components/ui/Badge';
import { shadow } from '@/lib/tokens';
import type { Release } from '@/lib/types';

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
      borderRadius: '12px',
      padding: '18px 20px',
      boxShadow: shadow.card,
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'oklch(0.95 0.005 260)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {release.title}
          </div>
          <div style={{ fontSize: '11.5px', color: 'oklch(0.52 0.012 260)', fontFamily: 'ui-monospace, monospace', marginTop: '3px' }}>
            {teamName} · {validatedCount}/{totalSteps} {t('steps')}
          </div>
        </div>
        <ReleaseStateBadge state={release.state} />
      </div>

      {totalSteps > 0 && (
        <div>
          <div style={{ display: 'flex', gap: '3px', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'oklch(0.16 0.015 260)' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10.5px', color: 'oklch(0.52 0.012 260)' }}>
            <span>{release.steps[0]?.name}</span>
            {totalSteps > 1 && <span>{release.steps[totalSteps - 1]?.name}</span>}
          </div>
        </div>
      )}

      <Link href={`/releases/${release.id}`} style={{ textDecoration: 'none' }}>
        <div style={{
          textAlign: 'center', padding: '9px', borderRadius: '8px',
          border: '1px solid oklch(0.34 0.02 260)', fontSize: '13px', fontWeight: 600,
          color: 'oklch(0.90 0.005 260)',
        }}>
          {t('view')}
        </div>
      </Link>
    </div>
  );
}