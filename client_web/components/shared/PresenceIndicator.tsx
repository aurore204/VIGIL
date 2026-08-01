
interface PresenceIndicatorProps {
  watchers: string[];
}
import { shadow } from '@/lib/tokens';
export function PresenceIndicator({ watchers }: PresenceIndicatorProps) {
  const uniqueWatchers = Array.from(new Set(watchers));
  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '10px',
      padding: '12px 18px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      boxShadow: shadow.card,
      gap: '14px',
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.04em', color: 'oklch(0.55 0.01 260)', flexShrink: 0,
      }}>
        Présents actuellement
      </span>
      {watchers.length === 0 ? (
        <span style={{ fontSize: '12px', color: 'oklch(0.42 0.01 260)', fontStyle: 'italic' }}>
          Personne d&apos;autre ne regarde cet incident
        </span>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {watchers.map(username => (
            <div key={username} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '3px 10px 3px 4px', borderRadius: '20px',
              background: 'oklch(0.22 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
            }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'oklch(0.30 0.03 255)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', fontWeight: 700, color: 'oklch(0.85 0.05 255)', flexShrink: 0,
              }}>
                {username.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: '12px', color: 'oklch(0.85 0.005 260)', fontWeight: 500 }}>
                {username}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}