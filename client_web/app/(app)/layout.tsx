'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import { useToast } from '@/components/ui/Toast';
import type { WsEvent } from '@/lib/types';
import {
  LayoutGrid, AlertTriangle, Rocket, Users, MessageCircle,
  ChevronLeft, ChevronRight, LogOut, Radar, Zap,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { href: '/incidents', label: 'Incidents', Icon: AlertTriangle },
  { href: '/releases', label: 'Releases', Icon: Rocket },
  { href: '/rules', label: 'Rules', Icon: Zap },
  { href: '/teams', label: 'Teams', Icon: Users },
  { href: '/messages', label: 'Messages', Icon: MessageCircle },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated, clearAuth, setUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('vigil_sidebar_collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem('vigil_sidebar_collapsed', String(!prev));
      return !prev;
    });
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('vigil_token');
    const activeToken = token || storedToken;

    if (!activeToken || !isAuthenticated()) {
      router.push('/auth/login');
      return;
    }

    if (!user) {
      api.me().then(setUser).catch(() => {
        clearAuth();
        router.push('/auth/login');
      });
    }

    vigilWs.connect(activeToken);

    const onIncidentStateChanged = (e: WsEvent) => {
      if (e.type !== 'incident_state_changed') return;
      showToast(`Incident ${e.new_state} par ${e.by}`, 'info');
    };
    const onIncidentEscalated = (e: WsEvent) => {
      if (e.type !== 'incident_escalated') return;
      showToast(`Incident escaladé en ${e.new_severity} par ${e.by}`, 'warning');
    };
    const onIncidentAssigned = (e: WsEvent) => {
      if (e.type !== 'incident_assigned') return;
      showToast(`Incident assigné à ${e.assigned_to}`, 'info');
    };
    const onTimelineEntryAdded = (e: WsEvent) => {
      if (e.type !== 'timeline_entry_added') return;
      showToast(`Nouvelle entrée timeline par ${e.entry.author}`, 'info');
    };
    const onReleaseStateChanged = (e: WsEvent) => {
      if (e.type !== 'release_state_changed') return;
      if (e.new_state === 'blocked') showToast('Release bloquée par un incident', 'error');
      else if (e.new_state === 'completed') showToast('Release complétée', 'success');
      else showToast(`Release : ${e.new_state}`, 'info');
    };
    const onReleaseStepValidated = (e: WsEvent) => {
      if (e.type !== 'release_step_validated') return;
      showToast(`Étape "${e.step}" validée par ${e.by}`, 'success');
    };
    const onMemberKicked = (e: WsEvent) => {
      if (e.type !== 'member_kicked') return;
      showToast(`${e.member} retiré de la team`, 'warning');
    };
    const onMemberBanned = (e: WsEvent) => {
      if (e.type !== 'member_banned') return;
      showToast(`${e.member} banni`, 'error');
    };
    const onPrivateMessageReceived = (e: WsEvent) => {
      if (e.type !== 'private_message_received') return;
      showToast(`Nouveau message de ${e.from}`, 'info');
    };
    const onReactionAdded = (e: WsEvent) => {
      if (e.type !== 'reaction_added') return;
      showToast(`${e.by} a réagi avec ${e.emoji}`, 'info');
    };

    vigilWs.on('incident_state_changed', onIncidentStateChanged);
    vigilWs.on('incident_escalated', onIncidentEscalated);
    vigilWs.on('incident_assigned', onIncidentAssigned);
    vigilWs.on('timeline_entry_added', onTimelineEntryAdded);
    vigilWs.on('release_state_changed', onReleaseStateChanged);
    vigilWs.on('release_step_validated', onReleaseStepValidated);
    vigilWs.on('member_kicked', onMemberKicked);
    vigilWs.on('member_banned', onMemberBanned);
    vigilWs.on('private_message_received', onPrivateMessageReceived);
    vigilWs.on('reaction_added', onReactionAdded);

    return () => {
      vigilWs.off('incident_state_changed', onIncidentStateChanged);
      vigilWs.off('incident_escalated', onIncidentEscalated);
      vigilWs.off('incident_assigned', onIncidentAssigned);
      vigilWs.off('timeline_entry_added', onTimelineEntryAdded);
      vigilWs.off('release_state_changed', onReleaseStateChanged);
      vigilWs.off('release_step_validated', onReleaseStepValidated);
      vigilWs.off('member_kicked', onMemberKicked);
      vigilWs.off('member_banned', onMemberBanned);
      vigilWs.off('private_message_received', onPrivateMessageReceived);
      vigilWs.off('reaction_added', onReactionAdded);
      vigilWs.disconnect();
    };
  }, [token]);

  const handleLogout = async () => {
    clearAuth();
    vigilWs.disconnect();
    router.push('/auth/login');
  };

  const sidebarWidth = collapsed ? '76px' : '224px';

  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'grid',
      gridTemplateColumns: `${sidebarWidth} 1fr`,
      transition: 'grid-template-columns 0.2s ease',
      background: '#0B0F1A', color: '#EAEEF5',
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px',
    }}>
      <div style={{
        background: '#0E1320', borderRight: '1px solid #1A2232',
        display: 'flex', flexDirection: 'column', padding: '20px 14px',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', overflow: 'hidden' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px', background: '#3D6FD1',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Radar size={16} color="#0B0F1A" aria-hidden="true" />
            </div>
            {!collapsed && (
              <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>VIGIL</span>
            )}
          </div>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Agrandir la barre de navigation' : 'Réduire la barre de navigation'}
            style={{
              width: '26px', height: '26px', borderRadius: '7px', border: '1px solid #232C3E',
              background: '#131A28', color: '#6B7889', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
          {navItems.map(item => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: '11px',
                  padding: collapsed ? '9px' : '9px 10px', borderRadius: '8px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  fontSize: '13px', fontWeight: 500, textDecoration: 'none',
                  background: isActive ? '#182238' : 'transparent',
                  color: isActive ? '#9DC0F0' : '#79879C',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                }}
              >
                <item.Icon size={17} style={{ flexShrink: 0 }} aria-hidden="true" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{
          background: '#131A28', border: '1px solid #202A3C', borderRadius: '11px',
          padding: '11px', display: 'flex', flexDirection: 'column', gap: '9px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div style={{
              width: '29px', height: '29px', borderRadius: '50%', background: '#1E3A63',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 600, color: '#8FB3E8', flexShrink: 0,
            }}>
              {user?.username?.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.username}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#5FAE84' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#42B085', flexShrink: 0 }} />
                  Connecté
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Déconnexion' : undefined}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '6px', borderRadius: '7px', border: '1px solid #262F41', background: 'transparent',
              color: '#8592A6', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <LogOut size={13} aria-hidden="true" />
            {!collapsed && 'Déconnexion'}
          </button>
        </div>
      </div>

      <div style={{ overflow: 'auto', minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  );
}