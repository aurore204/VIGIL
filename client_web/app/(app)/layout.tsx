'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { vigilWs } from '@/lib/websocket';
import { useToast } from '@/components/ui/Toast';
import type { WsEvent } from '@/lib/types';

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1.5"/>
        <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        <rect x="3" y="16" width="7" height="5" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: '/incidents',
    label: 'Incidents',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 20h20L12 2z"/>
        <path d="M12 9v5" strokeLinecap="round"/>
        <circle cx="12" cy="17" r="0.6" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: '/releases',
    label: 'Releases',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <path d="M3 9h18M8 4v-1M16 4v-1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/teams',
    label: 'Teams',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="7" r="3"/>
        <circle cx="17" cy="9" r="2.5"/>
        <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/>
        <path d="M17 14c2.2.4 4 2.1 4 4.5"/>
      </svg>
    ),
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  useEffect(() => {
  if (!isAuthenticated()) {
    router.push('/auth/login');
    return;
  }
  if (token) {
    vigilWs.connect(token);

    vigilWs.on('incident_state_changed', (e: WsEvent) => {
      showToast(`Incident ${e.new_state} par ${e.by}`, 'info');
    });
    vigilWs.on('incident_escalated', (e: WsEvent) => {
      showToast(`Incident escaladé en ${e.new_severity} par ${e.by}`, 'warning');
    });
    vigilWs.on('incident_assigned', (e: WsEvent) => {
      showToast(`Incident assigné à ${e.assigned_to}`, 'info');
    });
    vigilWs.on('timeline_entry_added', (e: WsEvent) => {
      showToast(`Nouvelle entrée timeline par ${e.entry.author}`, 'info');
    });
    vigilWs.on('release_state_changed', (e: WsEvent) => {
      if (e.new_state === 'blocked') {
        showToast('Une release a été bloquée par un incident', 'error');
      } else if (e.new_state === 'completed') {
        showToast('Release complétée avec succès', 'success');
      } else {
        showToast(`Release passée en ${e.new_state}`, 'info');
      }
    });
    vigilWs.on('release_step_validated', (e: WsEvent) => {
      showToast(`Étape "${e.step}" validée par ${e.by}`, 'success');
    });
    vigilWs.on('member_kicked', (e: WsEvent) => {
      showToast(`${e.member} a été retiré de la team`, 'warning');
    });
    vigilWs.on('member_banned', (e: WsEvent) => {
      showToast(`${e.member} a été banni`, 'error');
    });
    vigilWs.on('private_message_received', (e: WsEvent) => {
      showToast(`Nouveau message de ${e.from}`, 'info');
    });
    vigilWs.on('reaction_added', (e: WsEvent) => {
      showToast(`${e.by} a réagi avec ${e.emoji}`, 'info');
    });
  }

  return () => {
    vigilWs.disconnect();
  };
}, [token]);

  const handleLogout = async () => {
    clearAuth();
    vigilWs.disconnect();
    router.push('/auth/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'grid',
      gridTemplateColumns: '240px 1fr',
      background: 'oklch(0.16 0.015 260)',
      color: 'oklch(0.95 0.005 260)',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '14px',
    }}>
      {/* Sidebar */}
      <div style={{
        background: 'oklch(0.14 0.015 260)',
        borderRight: '1px solid oklch(0.30 0.02 260)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0 8px 24px 8px'
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'oklch(0.66 0.16 255)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="oklch(0.16 0.015 260)" strokeWidth="2.6"/>
              <circle cx="12" cy="12" r="2.6" fill="oklch(0.16 0.015 260)"/>
            </svg>
          </div>
          <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.02em' }}>VIGIL</span>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {navItems.map(item => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 10px', borderRadius: '7px',
                  fontSize: '13px', fontWeight: 600,
                  textDecoration: 'none',
                  background: isActive ? 'oklch(0.66 0.16 255 / 0.15)' : 'transparent',
                  color: isActive ? 'oklch(0.75 0.14 255)' : 'oklch(0.72 0.01 260)',
                  transition: 'background 0.15s',
                }}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* User + logout */}
        <div style={{
          borderTop: '1px solid oklch(0.30 0.02 260)',
          paddingTop: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <Link href="/profile" style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 10px', borderRadius: '7px',
            textDecoration: 'none',
            color: 'oklch(0.72 0.01 260)',
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: 'oklch(0.66 0.16 255 / 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: 'oklch(0.75 0.14 255)',
              flexShrink: 0,
            }}>
              {user?.username?.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.username}
              </div>
              <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 10px', borderRadius: '7px',
              border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
              fontSize: '13px', fontWeight: 600,
              background: 'transparent', color: 'oklch(0.65 0.12 25)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{ overflow: 'auto', minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  );
}