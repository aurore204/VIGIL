'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { vigilWs } from '@/lib/websocket';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export default function ProfilePage() {
  const { user, clearAuth } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      clearAuth();
      vigilWs.disconnect();
      router.push('/auth/login');
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '600px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)', marginBottom: '24px' }}>
        Profil
      </div>

      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '10px', overflow: 'hidden', marginBottom: '16px',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid oklch(0.30 0.02 260)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'oklch(0.30 0.03 255)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
          }}>
            {user?.username?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
              {user?.username}
            </div>
            <div style={{ fontSize: '13px', color: 'oklch(0.52 0.012 260)' }}>
              {user?.email}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(0.72 0.01 260)', marginBottom: '6px' }}>
            Membre depuis
          </div>
          <div style={{ fontSize: '13px', color: 'oklch(0.90 0.005 260)' }}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-'}
          </div>
        </div>
      </div>

      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '10px', padding: '20px 24px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'oklch(0.90 0.005 260)', marginBottom: '16px' }}>
          Langue
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={{
              padding: '8px 20px', borderRadius: '7px',
              border: user?.language === 'fr' ? '2px solid oklch(0.66 0.16 255)' : '1px solid oklch(0.34 0.02 260)',
              background: user?.language === 'fr' ? 'oklch(0.22 0.04 255)' : 'transparent',
              color: 'oklch(0.90 0.005 260)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            FR
          </button>
          <button
            style={{
              padding: '8px 20px', borderRadius: '7px',
              border: user?.language === 'en' ? '2px solid oklch(0.66 0.16 255)' : '1px solid oklch(0.34 0.02 260)',
              background: user?.language === 'en' ? 'oklch(0.22 0.04 255)' : 'transparent',
              color: 'oklch(0.90 0.005 260)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            EN
          </button>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <Button variant="danger" onClick={() => setShowLogout(true)} style={{ width: '100%' }}>
          Se déconnecter
        </Button>
      </div>

      <ConfirmDialog
        isOpen={showLogout}
        title="Se déconnecter"
        description="Êtes-vous sûr de vouloir vous déconnecter ?"
        confirmLabel="Se déconnecter"
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />
    </div>
  );
}