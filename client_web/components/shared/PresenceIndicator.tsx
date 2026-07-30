interface PresenceIndicatorProps {
  watchers: string[];
}

export function PresenceIndicator({ watchers }: PresenceIndicatorProps) {
  if (watchers.length === 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '12px', color: 'oklch(0.60 0.01 260)',
      marginBottom: '20px',
    }}>
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: 'oklch(0.72 0.14 150)',
        animation: 'vigil-pulse 2s infinite',
      }} />
      {watchers.length} personne{watchers.length > 1 ? 's' : ''} regarde{watchers.length === 1 ? '' : 'nt'} cet incident
    </div>
  );
}