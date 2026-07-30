'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Release, Team, WsEvent } from '@/lib/types';
import { ReleaseStateBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StepList } from '@/components/releases/StepList';
import { useToast } from '@/components/ui/Toast';

export default function ReleaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();

  const [release, setRelease] = useState<Release | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<'cancel' | null>(null);

  const load = async () => {
    try {
      const rel = await api.getRelease(id);
      setRelease(rel);
      const t = await api.getTeam(rel.team_id);
      setTeam(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handleState = (e: WsEvent) => {
      if (e.type !== 'release_state_changed' || e.release_id !== id) return;
      load();
    };
    const handleStep = (e: WsEvent) => {
      if (e.type !== 'release_step_validated' || e.release_id !== id) return;
      load();
    };
    vigilWs.on('release_state_changed', handleState);
    vigilWs.on('release_step_validated', handleStep);
    return () => {
      vigilWs.off('release_state_changed', handleState);
      vigilWs.off('release_step_validated', handleStep);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !release) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>
  );

  const myRole = team?.members.find(m => m.user_id === user?.id)?.role ?? 'observer';
  const isManager = myRole === 'manager';
  const isResponder = myRole === 'responder' || myRole === 'manager';
  const completedSteps = release.steps.filter(s => s.state === 'completed').length;

  const handleStart = async () => {
    try { await api.startRelease(id); showToast('Release démarrée', 'success'); load(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  const handleCancel = async () => {
    try { await api.cancelRelease(id); showToast('Release annulée', 'success'); setConfirmAction(null); load(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  const handleValidateStep = async (stepId: string) => {
    try { await api.validateStep(id, stepId); showToast('Étape validée', 'success'); load(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  const currentStepIndex = release.steps.findIndex(s => s.state === 'pending');

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>
      <button
        onClick={() => router.push('/releases')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'oklch(0.60 0.01 260)',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '16px', padding: 0,
        }}
      >
        ← Retour
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.55 0.01 260)' }}>
              {release.id.slice(0, 8)}
            </div>
            <ReleaseStateBadge state={release.state} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)', marginBottom: '4px' }}>
            {release.title}
          </div>
          <div style={{ fontSize: '12px', color: 'oklch(0.55 0.01 260)' }}>
            {team?.name} · {completedSteps}/{release.steps.length} étapes · Créé le {new Date(release.created_at).toLocaleDateString('fr-FR')}
          </div>
        </div>

        {isManager && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {release.state === 'created' && (
              <Button onClick={handleStart}>▶ Démarrer</Button>
            )}
            {(release.state === 'created' || release.state === 'in_progress') && (
              <Button variant="danger" onClick={() => setConfirmAction('cancel')}>Annuler</Button>
            )}
          </div>
        )}
      </div>

      {release.description && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px',
          background: 'oklch(0.22 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
          fontSize: '13px', color: 'oklch(0.75 0.01 260)', marginBottom: '24px',
        }}>
          {release.description}
        </div>
      )}

      {/* Étapes */}
      <div style={{
        background: 'oklch(0.195 0.015 260)',
        border: '1px solid oklch(0.30 0.02 260)',
        borderRadius: '10px', overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid oklch(0.30 0.02 260)',
          fontSize: '13px', fontWeight: 700, color: 'oklch(0.90 0.005 260)',
        }}>
          Étapes
        </div>

        <div style={{ padding: '16px' }}>
          <StepList steps={release.steps} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {release.steps.map((step, i) => {
            const isCurrentStep = i === currentStepIndex;
            const isCompleted = step.state === 'completed';
            const isLocked = i > currentStepIndex && currentStepIndex !== -1;

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderTop: '1px solid oklch(0.27 0.015 260)',
                  background: isCurrentStep ? 'oklch(0.20 0.025 255)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: isCompleted ? 'oklch(0.72 0.14 150)' : isCurrentStep ? 'oklch(0.66 0.16 255)' : 'oklch(0.27 0.015 260)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700,
                    color: isCompleted || isCurrentStep ? 'oklch(0.16 0.015 260)' : 'oklch(0.55 0.01 260)',
                    flexShrink: 0,
                  }}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '13px', fontWeight: 600,
                      color: isLocked ? 'oklch(0.45 0.01 260)' : 'oklch(0.90 0.005 260)',
                    }}>
                      {step.name}
                    </div>
                    {step.validated_at && (
                      <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)', marginTop: '2px' }}>
                        Validé le {new Date(step.validated_at).toLocaleString('fr-FR')}
                      </div>
                    )}
                  </div>
                </div>

                {isCurrentStep && isResponder && release.state === 'in_progress' && (
                  <Button onClick={() => handleValidateStep(step.id)}>
                    ✓ Valider
                  </Button>
                )}
                {isCompleted && (
                  <span style={{ fontSize: '12px', color: 'oklch(0.72 0.14 150)', fontWeight: 600 }}>
                    Complété
                  </span>
                )}
                {isLocked && (
                  <span style={{ fontSize: '12px', color: 'oklch(0.45 0.01 260)' }}>
                    Verrouillé
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {release.state === 'blocked' && (
        <div style={{
          marginTop: '16px', padding: '14px 16px', borderRadius: '10px',
          background: 'oklch(0.20 0.04 25)', border: '1px solid oklch(0.45 0.15 25)',
          fontSize: '13px', color: 'oklch(0.78 0.14 25)', fontWeight: 600,
        }}>
          ⊠ Release bloquée par un incident actif. La release reprendra automatiquement à la résolution de l&apos;incident.
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        title="Annuler la release"
        description={`Annuler définitivement "${release.title}" ?`}
        confirmLabel="Annuler la release"
        onConfirm={handleCancel}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}