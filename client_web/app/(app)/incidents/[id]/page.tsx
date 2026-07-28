'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Incident, Team, TimelineEntry, WsEvent } from '@/lib/types';
import { IncidentStateBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEntry, setNewEntry] = useState('');
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [watchers, setWatchers] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [availableReactions, setAvailableReactions] = useState<string[]>([]);
  const timelineEndRef = useRef<HTMLDivElement>(null);

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

    // Watch cet incident pour la présence
    if (team) {
      vigilWs.watch(id, 'incident', team.id);
    }

    // Écouter les events WS liés à cet incident
    const handleStateChanged = (e: WsEvent) => {
      if (e.type !== 'incident_state_changed' || e.incident_id !== id) return;
      setIncident(prev => prev ? { ...prev, state: e.new_state as Incident['state'] } : prev);
    };

    const handleTimelineAdded = (e: WsEvent) => {
      if (e.type !== 'timeline_entry_added' || e.incident_id !== id) return;
      load();
    };

    const handleTimelineEdited = (e: WsEvent) => {
      if (e.type !== 'timeline_entry_edited' || e.incident_id !== id) return;
      load();
    };

    const handlePresence = (e: WsEvent) => {
      if (e.type !== 'presence_update' || e.resource_id !== id) return;
      setWatchers(e.watchers);
    };

    const handleAssigned = (e: WsEvent) => {
      if (e.type !== 'incident_assigned' || e.incident_id !== id) return;
      load();
    };

    vigilWs.on('incident_state_changed', handleStateChanged);
    vigilWs.on('timeline_entry_added', handleTimelineAdded);
    vigilWs.on('timeline_entry_edited', handleTimelineEdited);
    vigilWs.on('presence_update', handlePresence);
    vigilWs.on('incident_assigned', handleAssigned);

    return () => {
      vigilWs.off('incident_state_changed', handleStateChanged);
      vigilWs.off('timeline_entry_added', handleTimelineAdded);
      vigilWs.off('timeline_entry_edited', handleTimelineEdited);
      vigilWs.off('presence_update', handlePresence);
      vigilWs.off('incident_assigned', handleAssigned);
      if (team) vigilWs.unwatch(id, 'incident', team.id);
    };
  }, [id, team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [incident?.timeline]);

  if (loading || !incident) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>
      Chargement...
    </div>
  );

  const myRole = team?.members.find(m => m.user_id === user?.id)?.role ?? 'observer';
  const isManager = myRole === 'manager';
  const isResponder = myRole === 'responder' || myRole === 'manager';
  const assignee = team?.members.find(m => m.user_id === incident.assigned_to);
  const responders = team?.members.filter(m => m.role === 'responder') ?? [];

  const canAcknowledge = isResponder && incident.state === 'open';
  const canEscalate = isResponder && incident.state === 'acknowledged';
  const canResolve = isManager && (incident.state === 'acknowledged' || incident.state === 'escalated');
  const canAssign = isManager && incident.state !== 'resolved';
  const canDelete = isManager;
  const canComment = isResponder && incident.state !== 'resolved';

  const handleAcknowledge = async () => {
    try {
      const updated = await api.acknowledgeIncident(id);
      setIncident(updated);
      showToast('Incident acquitté', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const handleEscalate = async () => {
    try {
      const updated = await api.escalateIncident(id, incident.severity === 'high' ? 'critical' : 'high');
      setIncident(updated);
      showToast('Incident escaladé', 'warning');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const handleResolve = async () => {
    try {
      const updated = await api.resolveIncident(id);
      setIncident(updated);
      showToast('Incident résolu', 'success');
      setConfirmAction(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteIncident(id);
      showToast('Incident supprimé', 'success');
      router.push('/incidents');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const handleAssign = async () => {
    if (!assignUserId) return;
    try {
      const updated = await api.assignResponder(id, assignUserId);
      setIncident(updated);
      showToast('Responder assigné', 'success');
      setShowAssign(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim()) return;
    setSubmittingEntry(true);
    try {
      await api.addTimelineEntry(id, newEntry.trim());
      setNewEntry('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSubmittingEntry(false);
    }
  };

  const handleEditEntry = async (entryId: string) => {
    if (!editContent.trim()) return;
    try {
      await api.editTimelineEntry(id, entryId, editContent);
      setEditingEntry(null);
      load();
      showToast('Entrée modifiée', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const handleReaction = async (entryId: string, emoji: string, hasReacted: boolean) => {
    try {
      if (hasReacted) {
        await api.removeReaction(id, entryId, emoji);
      } else {
        await api.addReaction(id, entryId, emoji);
      }
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    borderRadius: '8px', border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.16 0.015 260)', color: 'oklch(0.95 0.005 260)',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>
      {/* Back */}
      <button
        onClick={() => router.push('/incidents')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none',
          color: 'oklch(0.60 0.01 260)', cursor: 'pointer',
          fontSize: '12px', fontWeight: 600, marginBottom: '16px', padding: 0,
        }}
      >
        ← Retour
      </button>

      {/* Header */}
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
          {incident.resolved_at && ` · Résolu le ${new Date(incident.resolved_at).toLocaleDateString('fr-FR')}`}
        </div>
      </div>

      {/* Présence */}
      {watchers.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '20px', fontSize: '12px', color: 'oklch(0.60 0.01 260)',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'oklch(0.72 0.14 150)', animation: 'vigil-pulse 2s infinite' }} />
          {watchers.length} personne{watchers.length > 1 ? 's' : ''} regarde{watchers.length === 1 ? '' : 'nt'} cet incident
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
        {/* Timeline */}
        <div>
          <div style={{
            background: 'oklch(0.195 0.015 260)',
            border: '1px solid oklch(0.30 0.02 260)',
            borderRadius: '10px', padding: '18px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'oklch(0.90 0.005 260)', marginBottom: '16px' }}>
              Timeline
            </div>

            {incident.description && (
              <div style={{
                padding: '12px 14px', borderRadius: '8px',
                background: 'oklch(0.22 0.02 260)',
                border: '1px solid oklch(0.30 0.02 260)',
                fontSize: '13px', color: 'oklch(0.75 0.01 260)',
                marginBottom: '16px',
              }}>
                {incident.description}
              </div>
            )}

            {incident.timeline.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                Aucune entrée dans la timeline
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {incident.timeline.map((entry: TimelineEntry) => {
                  const isAuthor = entry.author_id === user?.id;
                  const isEditing = editingEntry === entry.id;

                  return (
                    <div key={entry.id} style={{ display: 'flex', gap: '10px' }}>
                      {/* Avatar */}
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'oklch(0.30 0.03 255)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
                        flexShrink: 0, marginTop: '2px',
                      }}>
                        {entry.author_username.slice(0, 2).toUpperCase()}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)' }}>
                            {entry.author_username}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.52 0.012 260)' }}>
                            {new Date(entry.created_at).toLocaleString('fr-FR')}
                          </span>
                          {entry.edited_at && (
                            <span style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic' }}>
                              (modifié)
                            </span>
                          )}
                          {isAuthor && !isEditing && incident.state !== 'resolved' && (
                            <button
                              onClick={() => { setEditingEntry(entry.id); setEditContent(entry.content); }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '11px', color: 'oklch(0.52 0.012 260)',
                                padding: '0 4px',
                              }}
                            >
                              Modifier
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              style={{ ...inputStyle, flex: 1 }}
                              autoFocus
                            />
                            <Button onClick={() => handleEditEntry(entry.id)}>Sauvegarder</Button>
                            <Button variant="secondary" onClick={() => setEditingEntry(null)}>Annuler</Button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '13px', color: 'oklch(0.80 0.005 260)', lineHeight: 1.5 }}>
                            {entry.content}
                          </div>
                        )}

                        {/* Réactions */}
                        {!isEditing && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {entry.reactions?.map(r => {
                              const hasReacted = r.users.includes(user?.username ?? '');
                              return (
                                <button
                                  key={r.emoji}
                                  onClick={() => handleReaction(entry.id, r.emoji, hasReacted)}
                                  title={r.users.join(', ')}
                                  style={{
                                    fontSize: '11px',
                                    background: hasReacted ? 'oklch(0.28 0.04 255)' : 'oklch(0.235 0.015 260)',
                                    border: `1px solid ${hasReacted ? 'oklch(0.45 0.12 255)' : 'oklch(0.30 0.02 260)'}`,
                                    borderRadius: '10px', padding: '2px 8px',
                                    cursor: 'pointer', color: 'oklch(0.90 0.005 260)',
                                  }}
                                >
                                  {r.emoji} {r.count}
                                </button>
                              );
                            })}
                            {isResponder && availableReactions.map(emoji => {
                              const existing = entry.reactions?.find(r => r.emoji === emoji);
                              if (existing) return null;
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(entry.id, emoji, false)}
                                  style={{
                                    fontSize: '11px',
                                    background: 'transparent',
                                    border: '1px solid oklch(0.27 0.015 260)',
                                    borderRadius: '10px', padding: '2px 8px',
                                    cursor: 'pointer', color: 'oklch(0.52 0.012 260)',
                                    opacity: 0.6,
                                  }}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={timelineEndRef} />
              </div>
            )}

            {/* Ajouter une entrée */}
            {canComment && (
              <form
                onSubmit={handleAddEntry}
                style={{
                  display: 'flex', gap: '8px', marginTop: '16px',
                  paddingTop: '16px', borderTop: '1px solid oklch(0.27 0.015 260)',
                }}
              >
                <input
                  value={newEntry}
                  onChange={e => setNewEntry(e.target.value)}
                  placeholder="Ajouter une entrée à la timeline..."
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: '7px',
                    border: '1px solid oklch(0.34 0.02 260)',
                    background: 'oklch(0.16 0.015 260)',
                    color: 'oklch(0.95 0.005 260)', fontSize: '13px', outline: 'none',
                  }}
                />
                <Button type="submit" loading={submittingEntry}>
                  Envoyer
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Panel actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Actions */}
          <div style={{
            background: 'oklch(0.195 0.015 260)',
            border: '1px solid oklch(0.30 0.02 260)',
            borderRadius: '10px', padding: '18px',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.03em', color: 'oklch(0.55 0.01 260)', marginBottom: '12px',
            }}>
              Actions disponibles
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {canAcknowledge && (
                <button
                  onClick={handleAcknowledge}
                  style={{
                    padding: '9px 12px', borderRadius: '7px',
                    border: '1px solid oklch(0.34 0.02 260)',
                    background: 'oklch(0.235 0.015 260)',
                    color: 'oklch(0.95 0.005 260)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  ◑ Acquitter
                </button>
              )}
              {canEscalate && (
                <button
                  onClick={handleEscalate}
                  style={{
                    padding: '9px 12px', borderRadius: '7px',
                    border: '1px solid oklch(0.34 0.02 260)',
                    background: 'oklch(0.235 0.015 260)',
                    color: 'oklch(0.95 0.005 260)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  ▲ Escalader
                </button>
              )}
              {canAssign && (
                <button
                  onClick={() => setShowAssign(true)}
                  style={{
                    padding: '9px 12px', borderRadius: '7px',
                    border: '1px solid oklch(0.34 0.02 260)',
                    background: 'oklch(0.235 0.015 260)',
                    color: 'oklch(0.95 0.005 260)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  → Assigner un Responder
                </button>
              )}
              {canResolve && (
                <button
                  onClick={() => setConfirmAction('resolve')}
                  style={{
                    padding: '9px 12px', borderRadius: '7px', border: 'none',
                    background: 'oklch(0.72 0.14 150)',
                    color: 'oklch(0.16 0.015 260)',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  ● Résoudre l&apos;incident
                </button>
              )}
              {!canAcknowledge && !canEscalate && !canAssign && !canResolve && (
                <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic' }}>
                  Aucune action disponible
                </div>
              )}
              {canDelete && (
                <button
                  onClick={() => setConfirmAction('delete')}
                  style={{
                    padding: '9px 12px', borderRadius: '7px',
                    border: '1px solid oklch(0.45 0.15 25 / 0.5)',
                    background: 'transparent',
                    color: 'oklch(0.75 0.15 25)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                    marginTop: '4px',
                  }}
                >
                  Supprimer l&apos;incident
                </button>
              )}
            </div>
          </div>

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
              {incident.resolved_at && (
                <div>
                  <div style={{ fontSize: '11px', color: 'oklch(0.55 0.01 260)', marginBottom: '3px' }}>Résolu le</div>
                  <span style={{ color: 'oklch(0.72 0.14 150)' }}>
                    {new Date(incident.resolved_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Assigner */}
      {showAssign && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'oklch(0 0 0 / 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowAssign(false); }}
        >
          <div style={{
            background: 'oklch(0.195 0.015 260)',
            border: '1px solid oklch(0.34 0.02 260)',
            borderRadius: '14px', padding: '24px',
            width: '100%', maxWidth: '380px',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'oklch(0.95 0.005 260)', marginBottom: '16px' }}>
              Assigner un Responder
            </div>
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
                      color: 'oklch(0.90 0.005 260)', textAlign: 'left',
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
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction === 'resolve'}
        title="Résoudre l'incident"
        description={`Confirmer la résolution de "${incident.title}" ?`}
        confirmLabel="Résoudre"
        onConfirm={handleResolve}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'delete'}
        title="Supprimer l'incident"
        description={`Supprimer définitivement "${incident.title}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}