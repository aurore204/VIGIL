'use client';

import { useState } from 'react';
import type { TimelineEntry } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface IncidentTimelineProps {
  timeline: TimelineEntry[];
  canComment: boolean;
  isResponder: boolean;
  currentUserId: string;
  availableReactions: string[];
  currentUsername: string;
  onAddEntry: (content: string) => Promise<void>;
  onEditEntry: (entryId: string, content: string) => Promise<void>;
  onReaction: (entryId: string, emoji: string, hasReacted: boolean) => Promise<void>;
  description?: string | null;
}

export function IncidentTimeline({
  timeline,
  canComment,
  isResponder,
  currentUserId,
  availableReactions,
  currentUsername,
  onAddEntry,
  onEditEntry,
  onReaction,
  description,
}: IncidentTimelineProps) {
  const [newEntry, setNewEntry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim()) return;
    setSubmitting(true);
    try {
      await onAddEntry(newEntry.trim());
      setNewEntry('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (entryId: string) => {
    if (!editContent.trim()) return;
    await onEditEntry(entryId, editContent);
    setEditingId(null);
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '9px 12px', borderRadius: '7px',
    border: '1px solid oklch(0.34 0.02 260)',
    background: 'oklch(0.16 0.015 260)',
    color: 'oklch(0.95 0.005 260)', fontSize: '13px', outline: 'none',
  };

  return (
    <div style={{
      background: 'oklch(0.195 0.015 260)',
      border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: '10px', padding: '18px',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'oklch(0.90 0.005 260)', marginBottom: '16px' }}>
        Timeline
      </div>

      {description && (
        <div style={{
          padding: '12px 14px', borderRadius: '8px',
          background: 'oklch(0.22 0.02 260)',
          border: '1px solid oklch(0.30 0.02 260)',
          fontSize: '13px', color: 'oklch(0.75 0.01 260)',
          marginBottom: '16px',
        }}>
          {description}
        </div>
      )}

      {timeline.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          Aucune entrée dans la timeline
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {timeline.map(entry => {
            const isAuthor = entry.author_id === currentUserId;
            const isEditing = editingId === entry.id;

            return (
              <div key={entry.id} style={{ display: 'flex', gap: '10px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)' }}>
                      {entry.author_username}
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.52 0.012 260)' }}>
                      {new Date(entry.created_at).toLocaleString('fr-FR')}
                    </span>
                    {entry.edited_at && (
                      <span style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic' }}>(modifié)</span>
                    )}
                    {isAuthor && !isEditing && (
                      <button
                        onClick={() => { setEditingId(entry.id); setEditContent(entry.content); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'oklch(0.52 0.012 260)', padding: '0 4px' }}
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
                        style={{ ...inputStyle }}
                        autoFocus
                      />
                      <Button onClick={() => handleEdit(entry.id)}>Sauvegarder</Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)}>Annuler</Button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'oklch(0.80 0.005 260)', lineHeight: 1.5 }}>
                      {entry.content}
                    </div>
                  )}

                  {!isEditing && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {entry.reactions?.map(r => {
                        const hasReacted = r.users.includes(currentUsername);
                        return (
                          <button
                            key={r.emoji}
                            onClick={() => onReaction(entry.id, r.emoji, hasReacted)}
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
                            onClick={() => onReaction(entry.id, emoji, false)}
                            style={{
                              fontSize: '11px', background: 'transparent',
                              border: '1px solid oklch(0.27 0.015 260)',
                              borderRadius: '10px', padding: '2px 8px',
                              cursor: 'pointer', color: 'oklch(0.52 0.012 260)', opacity: 0.6,
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
        </div>
      )}

      {canComment && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex', gap: '8px', marginTop: '16px',
            paddingTop: '16px', borderTop: '1px solid oklch(0.27 0.015 260)',
          }}
        >
          <input
            value={newEntry}
            onChange={e => setNewEntry(e.target.value)}
            placeholder="Ajouter une entrée à la timeline..."
            style={inputStyle}
          />
          <Button type="submit" loading={submitting}>Envoyer</Button>
        </form>
      )}
    </div>
  );
}