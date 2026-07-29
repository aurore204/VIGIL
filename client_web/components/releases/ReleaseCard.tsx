import type { Release } from '@/lib/types';
import { ReleaseStateBadge } from '@/components/ui/Badge';
import { StepList } from './StepList';
import Link from 'next/link';

interface ReleaseCardProps {
  release: Release;
}

export function ReleaseCard({ release }: ReleaseCardProps) {
  const completedSteps = release.steps.filter(s => s.state === 'completed').length;
  const totalSteps = release.steps.length;

  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '10px', padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
            {release.title}
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.55 0.01 260)', marginTop: '2px' }}>
            {release.id.slice(0, 8)} · {completedSteps}/{totalSteps} étapes
          </div>
        </div>
        <ReleaseStateBadge state={release.state} />
      </div>

      <StepList steps={release.steps} />

      <Link href={`/releases/${release.id}`} style={{ textDecoration: 'none' }}>
        <div style={{
          width: '100%', padding: '8px 14px', borderRadius: '7px',
          border: '1px solid oklch(0.34 0.02 260)',
          background: 'transparent', color: 'oklch(0.90 0.005 260)',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          textAlign: 'center', marginTop: '12px',
        }}>
          Voir la release
        </div>
      </Link>
    </div>
  );
}