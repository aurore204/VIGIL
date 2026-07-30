'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Tous les champs sont requis');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const data = await api.login(email, password);
      setAuth(data.user, data.token);
      showToast('Connexion réussie !', 'success');
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '360px' }}>
      {/* Tabs login/register */}
      <div style={{
        display: 'flex', gap: '4px',
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.34 0.02 260)',
        borderRadius: '10px', padding: '4px', marginBottom: '28px'
      }}>
        <div style={{
          flex: 1, padding: '9px', borderRadius: '7px',
          fontSize: '13px', fontWeight: 700, textAlign: 'center',
          background: 'oklch(0.66 0.16 255)',
          color: 'oklch(0.16 0.015 260)'
        }}>
          Connexion
        </div>
        <Link href="/auth/register" style={{
          flex: 1, padding: '9px', borderRadius: '7px',
          fontSize: '13px', fontWeight: 600, textAlign: 'center',
          background: 'transparent', color: 'oklch(0.72 0.01 260)',
          textDecoration: 'none', display: 'block'
        }}>
          Inscription
        </Link>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {/* Email */}
        <label style={{
          display: 'block', fontSize: '12px', fontWeight: 600,
          color: 'oklch(0.72 0.01 260)', marginBottom: '6px'
        }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="vous@entreprise.com"
          required
          autoComplete="email"
          style={{
            width: '100%', padding: '10px 12px', marginBottom: '16px',
            borderRadius: '8px', border: '1px solid oklch(0.34 0.02 260)',
            background: 'oklch(0.195 0.015 260)', color: 'oklch(0.95 0.005 260)',
            fontSize: '14px', outline: 'none'
          }}
        />

        {/* Mot de passe */}
        <label style={{
          display: 'block', fontSize: '12px', fontWeight: 600,
          color: 'oklch(0.72 0.01 260)', marginBottom: '6px'
        }}>
          Mot de passe
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          style={{
            width: '100%', padding: '10px 12px', marginBottom: '8px',
            borderRadius: '8px', border: '1px solid oklch(0.34 0.02 260)',
            background: 'oklch(0.195 0.015 260)', color: 'oklch(0.95 0.005 260)',
            fontSize: '14px', outline: 'none'
          }}
        />

        {/* Erreur */}
        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px', marginBottom: '8px',
            background: 'oklch(0.25 0.05 25)', border: '1px solid oklch(0.45 0.15 25)',
            color: 'oklch(0.85 0.12 25)', fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {/* Bouton */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', marginTop: '12px', padding: '11px',
            borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 700,
            background: loading ? 'oklch(0.50 0.10 255)' : 'oklch(0.66 0.16 255)',
            color: 'oklch(0.16 0.015 260)'
          }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}