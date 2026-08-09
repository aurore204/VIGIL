'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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

const emojiMap: Record<string, string> = {
  '+1': '👍',
  '-1': '👎',
  eyes: '👀',
  warning: '⚠️',
  check: '✅',
  fire: '🔥',
};

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
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);
  const t = useTranslations('incidents.timeline');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US';

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
      overflow: 'hidden',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'oklch(0.90 0.005 260)', marginBottom: '16px' }}>
        {t('title')}
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
          {t('empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          {timeline.map(entry => {
            const isAuthor = entry.author_id === currentUserId;
            const isEditing = editingId === entry.id;
            const postedReactions = (entry.reactions ?? []).filter(r => r.count > 0);
            const isHovered = hoveredEntryId === entry.id;
            const canPick = isResponder && !isEditing;

            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', gap: '10px', width: '100%',
                  flexDirection: isAuthor ? 'row-reverse' : 'row',
                }}
                onMouseEnter={() => setHoveredEntryId(entry.id)}
                onMouseLeave={() => setHoveredEntryId(null)}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'oklch(0.30 0.03 255)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
                  flexShrink: 0, marginTop: '2px',
                }}>
                  {entry.author_username.slice(0, 2).toUpperCase()}
                </div>

                <div style={{
                  minWidth: 0, maxWidth: '75%',
                  display: 'flex', flexDirection: 'column',
                  alignItems: isAuthor ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap',
                    flexDirection: isAuthor ? 'row-reverse' : 'row',
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)' }}>
                      {entry.author_username}
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: 'oklch(0.52 0.012 260)' }}>
                      {new Date(entry.created_at).toLocaleString(dateLocale)}
                    </span>
                    {entry.edited_at && (
                      <span style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)', fontStyle: 'italic' }}>{t('edited')}</span>
                    )}
                    {isAuthor && !isEditing && (
                      <button
                        onClick={() => { setEditingId(entry.id); setEditContent(entry.content); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'oklch(0.52 0.012 260)', padding: '0 4px' }}
                      >
                        {t('editButton')}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <input
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        style={{ ...inputStyle }}
                        autoFocus
                      />
                      <Button onClick={() => handleEdit(entry.id)}>{t('save')}</Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)}>{t('cancel')}</Button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', maxWidth: '100%' }}>
                      {/* Palette au survol, pour ajouter une réaction */}
                      {canPick && isHovered && (
                        <div style={{
                          position: 'absolute', top: '-34px',
                          right: isAuthor ? 0 : undefined,
                          left: isAuthor ? undefined : 0,
                          display: 'flex', gap: '2px',
                          background: 'oklch(0.24 0.018 260)',
                          border: '1px solid oklch(0.32 0.02 260)',
                          borderRadius: '18px', padding: '4px 6px',
                          boxShadow: '0 3px 10px oklch(0 0 0 / 0.4)',
                          zIndex: 3,
                        }}>
                          {availableReactions.map(emoji => {
                            const existing = entry.reactions?.find(r => r.emoji === emoji);
                            const hasReacted = existing?.users.includes(currentUsername) ?? false;
                            return (
                              <button
                                key={emoji}
                                onClick={() => onReaction(entry.id, emoji, hasReacted)}
                                title={emojiMap[emoji] ?? emoji}
                                style={{
                                  background: hasReacted ? 'oklch(0.30 0.05 255)' : 'transparent',
                                  border: 'none', borderRadius: '10px',
                                  padding: '3px 5px', cursor: 'pointer', fontSize: '15px',
                                  transition: 'transform 0.1s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.25)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                              >
                                {emojiMap[emoji] ?? emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div style={{
                        fontSize: '13px', lineHeight: 1.5,
                        color: isAuthor ? 'oklch(0.98 0.005 260)' : 'oklch(0.80 0.005 260)',
                        background: isAuthor ? 'oklch(0.55 0.16 255)' : 'oklch(0.22 0.017 260)',
                        border: isAuthor ? 'none' : '1px solid oklch(0.30 0.02 260)',
                        borderRadius: '14px',
                        padding: '10px 14px',
                        wordBreak: 'break-word',
                        maxWidth: '100%',
                      }}>
                        {entry.content}
                      </div>

                      {/* Réactions déjà posées, toujours visibles, attachées sous la bulle */}
                      {postedReactions.length > 0 && (
                        <div style={{
                          display: 'flex', gap: '4px', marginTop: '5px', flexWrap: 'wrap',
                          justifyContent: isAuthor ? 'flex-end' : 'flex-start',
                        }}>
                          {postedReactions.map(r => {
                            const hasReacted = r.users.includes(currentUsername);
                            return (
                              <button
                                key={r.emoji}
                                onClick={isResponder ? () => onReaction(entry.id, r.emoji, hasReacted) : undefined}
                                disabled={!isResponder}
                                title={r.users.join(', ')}
                                style={{
                                  fontSize: '11.5px',
                                  background: hasReacted ? 'oklch(0.28 0.04 255)' : 'oklch(0.24 0.018 260)',
                                  border: `1px solid ${hasReacted ? 'oklch(0.50 0.13 255)' : 'oklch(0.32 0.02 260)'}`,
                                  borderRadius: '11px', padding: '2px 8px',
                                  cursor: isResponder ? 'pointer' : 'default',
                                  color: 'oklch(0.92 0.005 260)',
                                  fontFamily: 'Inter, system-ui, sans-serif',
                                  display: 'flex', alignItems: 'center', gap: '3px',
                                }}
                              >
                                <span>{emojiMap[r.emoji] ?? r.emoji}</span>
                                <span style={{ fontSize: '10.5px', fontWeight: 600 }}>{r.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
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
            display: 'flex', gap: '8px', marginTop: '24px',
            paddingTop: '16px', borderTop: '1px solid oklch(0.27 0.015 260)',
          }}
        >
          <input
            value={newEntry}
            onChange={e => setNewEntry(e.target.value)}
            placeholder={t('placeholder')}
            style={inputStyle}
          />
          <Button type="submit" loading={submitting}>{t('send')}</Button>
        </form>
      )}
    </div>
  );
}