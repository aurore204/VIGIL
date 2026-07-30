'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export function Navbar() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const { showToast } = useToast();

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // On déconnecte quand même côté client
    } finally {
      clearAuth();
      showToast('Déconnexion réussie', 'success');
      router.push('/auth/login');
    }
  };

  return (
    <nav className="h-14 bg-surface border-b border-border flex items-center px-lg justify-between">
      <Link
        href="/dashboard"
        className="text-subtitle text-text-primary font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-primary rounded"
      >
        VIGIL
      </Link>

      <div className="flex items-center gap-md">
        {user && (
          <span className="text-caption text-text-secondary">
            {user.username}
          </span>
        )}
        <Button variant="ghost" onClick={handleLogout}>
          Déconnexion
        </Button>
      </div>
    </nav>
  );
}