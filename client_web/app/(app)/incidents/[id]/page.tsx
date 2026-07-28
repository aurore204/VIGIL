'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Incident, Team, WsEvent } from '@/lib/types';
import { IncidentStateBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import { IncidentActions } from '@/components/incidents/IncidentActions';
import { PresenceIndicator } from '@/components/shared/PresenceIndicator';
import { Modal } from '@/components/shared/Modal';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchers, setWatchers] = useState<string[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [availableReactions, setAvailableReactions] = useState<string[]>([]);

  const load = async () => {
    try {
      const inc = await api.getIncident(id);
      setIncident(inc);
      const t = await api.getTeam(inc.team_id);
      setTeam(t);
      const reactions = await api.getAvailableReactions();
      setAvailableReactions(reactions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    const handleState = (e: WsEvent) => {
      if (e.type !== 'incident_state_changed' || e.incident_id !== id) return;
      load();
    };
    const handleTimeline = (e: WsEvent) => {
      if (e.type !== 'timeline_entry_added' || e.incident_id !== id) return;
      load();
    };
    const handlePresence = (e: WsEvent) => {
      if (e.type !== 'presence_update' || e.resource_id !== id) return;
      setWatchers(e.watchers);
    };

    vigilWs.on('incident_state_changed', handleState);
    vigilWs.on('timeline_entry_added', handleTimeline);
    vigilWs.on('presence_update', handlePresence);

    return () => {
      vigilWs.off('incident_state_changed', handleState);
      vigilWs.off('timeline_entry_added', handleTimeline);
      vigilWs.off('presence_update', handlePresence);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !incident) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>
  );

  const myRole = team?.members.find(m => m.user_id === user?.id)?.role ?? 'observer';
  const isManager = myRole === 'manager';
  const isResponder = myRole === 'responder' || myRole === 'manager';
  const assignee = team?.members.find(m => m.user_id === incident.assigned_to);
  const responders = team?.members.filter(m => m.role === 'responder') ?? [];

  const handleAcknowledge = async () => {
    try {
      await api.acknowledgeIncident(id);
      showToast('Incident acquitté', 'success');
      load();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  const handleEscalate = async () => {
    try {
      await api.escalateIncident(id, incident.severity === 'high' ? 'critical' : 'high');
      showToast('Incident escaladé', 'warning');
      load();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  const handleResolve = async () => {
    try {
      await api.resolveIncident(id);
      showToast('Incident résolu', 'success');
      load();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  const handleDelete = async () => {
    try {
      await api.deleteIncident(id);
      showToast('Incident supprimé', 'success');
      router.push('/incidents');
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  const handleAssign = async () => {
    if (!assignUserId) return;
    try {
      await api.assignResponder(id, assignUserId);
      showToast('Responder assigné', 'success');
      setShowAssign(false);
      load();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  const handleAddEntry = async (content: string) => {
    await api.addTimelineEntry(id, content);
    load();
  };

  const handleEditEntry = async (entryId: string, content: string) => {
    await api.editTimelineEntry(id, entryId, content);
    showToast('Entrée modifiée', 'success');
    load();
  };

  const handleReaction = async (entryId: string, emoji: string, hasReacted: boolean) => {
    try {
      if (hasReacted) {
        await api.removeReaction(id, entryId, emoji);
      } else {
        await api.addReaction(id, entryId, emoji);
      }
      load();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      <button
        onClick={() => router.push('/incidents')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'oklch(0.60 0.01 260)',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '16px', padding: 0,
        }}
      >
        ← Retour
      </button>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <div style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.55 0.01 260)' }}>
            {incident.id.slice(0, 8)}
          </div>
          <SeverityBadge severity={incident.severity} />
          <IncidentStateBadge state={incident.state} />
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.95 0.005 260)', marginBottom: '6px' }}>
          {incident.title}
        </div>
        <div style={{ fontSize: '12px', color: 'oklch(0.55 0.01 260)' }}>
          {team?.name} · Créé le {new Date(incident.created_at).toLocaleDateString('fr-FR')}
        </div>
      </div>

      <PresenceIndicator watchers={watchers} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
        <IncidentTimeline
          timeline={incident.timeline}
          canComment={isResponder && incident.state !== 'resolved'}
          isResponder={isResponder}
          currentUserId={user?.id ?? ''}
          currentUsername={user?.username ?? ''}
          availableReactions={availableReactions}
          onAddEntry={handleAddEntry}
          onEditEntry={handleEditEntry}
          onReaction={handleReaction}
          description={incident.description}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <IncidentActions
            incident={incident}
            canAcknowledge={isResponder && incident.state === 'open'}
            canEscalate={isResponder && incident.state === 'acknowledged'}
            canResolve={isManager && (incident.state === 'acknowledged' || incident.state === 'escalated')}
            canAssign={isManager && incident.state !== 'resolved'}
            canDelete={isManager}
            onAcknowledge={handleAcknowledge}
            onEscalate={handleEscalate}
            onResolve={handleResolve}
            onAssign={() => setShowAssign(true)}
            onDelete={handleDelete}
          />

          {/* Infos */}
          <div style={{
            background: 'oklch(0.195 0.015 260)',
            border: '1px solid oklch(0.30 0.02 260)',
            borderRadius: '10px', padding: '18px',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.03em', color: 'oklch(0.55 0.01 260)', marginBottom: '12px',
            }}>
              Informations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'oklch(0.55 0.01 260)', marginBottom: '3px' }}>Assigné à</div>
                {assignee ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'oklch(0.30 0.03 255)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
                    }}>
                      {assignee.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ color: 'oklch(0.90 0.005 260)' }}>{assignee.username}</span>
                  </div>
                ) : (
                  <span style={{ color: 'oklch(0.45 0.01 260)', fontStyle: 'italic' }}>Non assigné</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'oklch(0.55 0.01 260)', marginBottom: '3px' }}>Team</div>
                <span style={{ color: 'oklch(0.90 0.005 260)' }}>{team?.name}</span>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'oklch(0.55 0.01 260)', marginBottom: '3px' }}>Créé le</div>
                <span style={{ color: 'oklch(0.90 0.005 260)' }}>
                  {new Date(incident.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAssign && (
        <Modal title="Assigner un Responder" onClose={() => setShowAssign(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {responders.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'oklch(0.52 0.012 260)' }}>
                Aucun Responder dans cette team
              </div>
            ) : (
              responders.map(m => (
                <button
                  key={m.user_id}
                  onClick={() => setAssignUserId(m.user_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${assignUserId === m.user_id ? 'oklch(0.66 0.16 255)' : 'oklch(0.34 0.02 260)'}`,
                    background: assignUserId === m.user_id ? 'oklch(0.22 0.04 255)' : 'oklch(0.16 0.015 260)',
                    color: 'oklch(0.90 0.005 260)', textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'oklch(0.30 0.03 255)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
                  }}>
                    {m.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.username}</span>
                </button>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowAssign(false)}>Annuler</Button>
            <Button onClick={handleAssign} disabled={!assignUserId}>Assigner</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}