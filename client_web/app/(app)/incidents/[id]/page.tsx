'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Incident, Team, WsEvent } from '@/lib/types';
import { IncidentStateBadge, SeverityBadge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import { IncidentActions } from '@/components/incidents/IncidentActions';
import { PresenceIndicator } from '@/components/shared/PresenceIndicator';
import { AssignModal } from '@/components/shared/AssignModal';
import { shadow } from '@/lib/tokens';

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

  useEffect(() => {
    if (!incident?.team_id) return;
    vigilWs.watch(id, 'incident', incident.team_id);
    return () => { vigilWs.unwatch(id, 'incident', incident.team_id); };
  }, [id, incident?.team_id]);

  if (loading || !incident) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>
  );

  const myRole = team?.members.find(m => m.user_id === user?.id)?.role ?? 'observer';
  const isManager = myRole === 'manager';
  const isResponder = myRole === 'responder' || myRole === 'manager';
  const responders = team?.members.filter(m => m.role === 'responder') ?? [];

  const handleAcknowledge = async () => {
    try { await api.acknowledgeIncident(id); showToast('Incident acquitté', 'success'); load(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };
  const handleEscalate = async () => {
    try { await api.escalateIncident(id, incident.severity === 'high' ? 'critical' : 'high'); showToast('Incident escaladé', 'warning'); load(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };
  const handleResolve = async () => {
    try { await api.resolveIncident(id); showToast('Incident résolu', 'success'); load(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };
  const handleDelete = async () => {
    try { await api.deleteIncident(id); showToast('Incident supprimé', 'success'); router.push('/incidents'); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };
  const handleAssign = async (userId: string) => {
    try { await api.assignResponder(id, userId); showToast('Responder assigné', 'success'); setShowAssign(false); load(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };
  const handleAddEntry = async (content: string) => { await api.addTimelineEntry(id, content); load(); };
  const handleEditEntry = async (entryId: string, content: string) => {
    await api.editTimelineEntry(id, entryId, content);
    showToast('Entrée modifiée', 'success');
    load();
  };
  const handleReaction = async (entryId: string, emoji: string, hasReacted: boolean) => {
    try {
      if (hasReacted) await api.removeReaction(id, entryId, emoji);
      else await api.addReaction(id, entryId, emoji);
      load();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erreur', 'error'); }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <button
        onClick={() => router.push('/incidents')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: 'oklch(0.60 0.01 260)',
          cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '18px', padding: 0,
        }}
      >
         Retour
      </button>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <SeverityBadge severity={incident.severity} />
          <IncidentStateBadge state={incident.state} />
          
        </div>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(0.95 0.005 260)', marginBottom: '6px' }}>
          {incident.title}
        </div>
        <div style={{ fontSize: '12.5px', color: 'oklch(0.55 0.01 260)' }}>
          {team?.name}  ,Créé le {new Date(incident.created_at).toLocaleString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <PresenceIndicator watchers={watchers} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {incident.description && (
            <div style={{
              background: 'oklch(0.195 0.015 260)', border: '1px solid oklch(0.30 0.02 260)',
              borderRadius: '12px', padding: '18px',
              boxShadow: shadow.card,
            }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.03em', color: 'oklch(0.55 0.01 260)', marginBottom: '10px',
              }}>
                Description
              </div>
              <div style={{ fontSize: '13.5px', color: 'oklch(0.80 0.005 260)', lineHeight: 1.6 }}>
                {incident.description}
              </div>
            </div>
          )}

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
            description={null}
          />
        </div>

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
      </div>

      {showAssign && (
        <AssignModal
          responders={responders}
          onClose={() => setShowAssign(false)}
          onAssign={handleAssign}
        />
      )}
    </div>
  );
}