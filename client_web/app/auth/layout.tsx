export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '8px',
            background: 'oklch(0.66 0.16 255)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="oklch(0.16 0.015 260)" strokeWidth="2.4"/>
              <circle cx="12" cy="12" r="2.6" fill="oklch(0.16 0.015 260)"/>
            </svg>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.02em' }}>VIGIL</div>
        </div>

        {/* Tagline */}
        <div>
          <div style={{ fontSize: '34px', fontWeight: 800, lineHeight: 1.15, maxWidth: '420px' }}>
            Contrôle opérationnel en temps réel
          </div>
          <div style={{ marginTop: '14px', fontSize: '15px', color: 'oklch(0.72 0.01 260)', maxWidth: '400px' }}>
            Gérez vos incidents et déploiements avec votre équipe, en temps réel.
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
        {children}
      </div>
    </div>
  );
}