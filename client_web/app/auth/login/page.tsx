'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const { setAuth } = useAuthStore();
  const router = useRouter();
  const { showToast } = useToast();

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = 'L\'email est requis';
    if (!email.includes('@')) newErrors.email = 'Email invalide';
    if (!password) newErrors.password = 'Le mot de passe est requis';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await api.login(email, password);
      setAuth(data.user, data.token);
      showToast('Connexion réussie', 'success');
      router.push('/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur de connexion', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-xl">
      <h2 className="text-subtitle text-text-primary mb-lg">Connexion</h2>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-md">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
          required
          autoComplete="email"
        />

        <Input
          label="Mot de passe"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={errors.password}
          required
          autoComplete="current-password"
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full mt-sm"
        >
          Se connecter
        </Button>
      </form>

      <p className="text-caption text-text-secondary text-center mt-lg">
        Pas encore de compte ?{' '}
        <Link
          href="/auth/register"
          className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          S'inscrire
        </Link>
      </p>
    </div>
  );
}