'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/shared/Modal';
import { useToast } from '@/components/ui/Toast';

interface WebhookSecretModalProps {
  teamId: string;
  onClose: () => void;
}

export function WebhookSecretModal({ teamId, onClose }: WebhookSecretModalProps) {
  const { showToast } = useToast();
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    setSaving(true);
    try {
      await api.createWebhookSecret(teamId, 'github', secret.trim());
      showToast('Secret webhook configuré avec succès', 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Configurer le webhook GitHub" onClose={onClose} maxWidth="460px">
      <div style={{ fontSize: '13px', color: 'oklch(0.72 0.01 260)', marginBottom: '16px', lineHeight: 1.5 }}>
        Ce secret doit être identique à celui configuré dans les paramètres webhook de votre repo GitHub.
        <br /><br />
        URL à utiliser côté GitHub :
        <br />
        <code style={{ color: 'oklch(0.72 0.14 150)', fontSize: '12px', wordBreak: 'break-all' }}>
          /webhooks/github/{teamId}
        </code>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Input
          label="Secret"
          type="password"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          placeholder="Le même secret que côté GitHub"
          required
          autoFocus
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={saving}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}