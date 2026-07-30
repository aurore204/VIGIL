import type { ReleaseStep } from '@/lib/types';

interface StepListProps {
  steps: ReleaseStep[];
}

const stepColors: Record<string, string> = {
  completed: 'oklch(0.72 0.14 150)',
  in_progress: 'oklch(0.66 0.16 255)',
  pending: 'oklch(0.27 0.015 260)',
  cancelled: 'oklch(0.45 0.01 260)',
};

export function StepList({ steps }: StepListProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {steps.map(step => (
          <span key={step.id} style={{ fontSize: '10px', color: 'oklch(0.55 0.01 260)' }}>
            {step.name}
          </span>
        ))}
      </div>
    </div>
  );
}