import type { ReleaseStep, TeamMember } from '@/lib/types';
import { CheckCircle2 } from 'lucide-react';

interface StepListProps {
  steps: ReleaseStep[];
  members: TeamMember[];
}

const stepColors: Record<string, string> = {
  completed: 'oklch(0.72 0.14 150)',
  in_progress: 'oklch(0.66 0.16 255)',
  pending: 'oklch(0.27 0.015 260)',
  cancelled: 'oklch(0.45 0.01 260)',
};

function resolveUsername(userId: string | null, members: TeamMember[]): string | null {
  if (!userId) return null;
  return members.find(m => m.user_id === userId)?.username ?? userId;
}

export function StepList({ steps, members }: StepListProps) {
  return (
    <div style={{ marginTop: '14px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
        {steps.map(step => (
          <div
            key={step.id}
            title={step.name}
            style={{
              flex: 1, height: '6px', borderRadius: '3px',
              background: stepColors[step.state] ?? stepColors.pending,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {steps.map(step => {
          const validator = resolveUsername(step.validated_by, members);
          return (
            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px' }}>
              <span style={{ fontSize: '10px', color: 'oklch(0.55 0.01 260)', fontWeight: 600 }}>
                {step.name}
              </span>
              {validator && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'oklch(0.72 0.14 150)' }}>
                  <CheckCircle2 size={10} aria-hidden="true" />
                  {validator}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}