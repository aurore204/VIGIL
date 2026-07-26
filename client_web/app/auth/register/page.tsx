'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const { setAuth } = useAuthStore();
  const router = useRouter();
  const { showToast } = useToast();

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!username) newErrors.username = 'Le nom d\'utilisateur est requis';
    if (username.length < 3) newErrors.username = 'Minimum 3 caractères';
    if (!email) newErrors.email = 'L\'email est requis';
    if (!email.includes('@')) newErrors.email = 'Email invalide';
    if (!password) newErrors.password = 'Le mot de passe est requis';
    if (password.length < 8) newErrors.password = 'Minimum 8 caractères';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await api.register(email, password, username);
      setAuth(data.user, data.token);
      showToast('Compte créé avec succès', 'success');
      router.push('/dashboard');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de l\'inscription', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-xl">
      <h2 className="text-subtitle text-text-primary mb-lg">Créer un compte</h2>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-md">
        <Input
          label="Nom d'utilisateur"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          error={errors.username}
          required
          autoComplete="username"
        />

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
          hint="Minimum 8 caractères"
          required
          autoComplete="new-password"
        />

        <Input
          label="Confirmer le mot de passe"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full mt-sm"
        >
          Créer mon compte
        </Button>
      </form>

      <p className="text-caption text-text-secondary text-center mt-lg">
        Déjà un compte ?{' '}
        <Link
          href="/auth/login"
          className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}