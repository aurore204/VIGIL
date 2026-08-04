'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { vigilWs } from '@/lib/websocket';
import type { Team, TeamMember, PrivateMessage, WsEvent } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function MessagesPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [contacts, setContacts] = useState<TeamMember[]>([]);
  const [selectedContact, setSelectedContact] = useState<TeamMember | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);

  const load = async () => {
    try {
      const teamsData = await api.getTeams();
      setTeams(teamsData);
      const allMembers = new Map<string, TeamMember>();
      teamsData.forEach(t => {
        t.members.forEach(m => {
          if (m.user_id !== user?.id) allMembers.set(m.user_id, m);
        });
      });
      setContacts(Array.from(allMembers.values()));
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (contact: TeamMember) => {
    try {
      const msgs = await api.getConversation(contact.user_id);
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  };

  useEffect(() => {
    load();
    api.getOnlineUsers().then(setOnlineUsernames).catch(() => {});
  }, []);

  // Abonnement WS 
 useEffect(() => {
  const handleMessage = (e: WsEvent) => {
    if (e.type !== 'private_message_received') return;
    if (selectedContact && (e.from === selectedContact.username || e.to === selectedContact.username)) {
      loadConversation(selectedContact);
    }
  };
  const handlePresence = (e: WsEvent) => {
    if (e.type !== 'presence_online') return;
    setOnlineUsernames(e.usernames);
  };
  vigilWs.on('private_message_received', handleMessage);
  vigilWs.on('presence_online', handlePresence);
  return () => {
    vigilWs.off('private_message_received', handleMessage);
    vigilWs.off('presence_online', handlePresence);
  };
}, [selectedContact]);

  // Chargement de la conversation à chaque changement de contact sélectionné
  useEffect(() => {
    if (selectedContact) loadConversation(selectedContact);
  }, [selectedContact]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;
    setSending(true);
    try {
      await api.sendMessage(selectedContact.user_id, newMessage.trim());
      setNewMessage('');
      loadConversation(selectedContact);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div style={{ padding: '32px', color: 'oklch(0.72 0.01 260)', fontSize: '13px' }}>Chargement...</div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar contacts */}
      <div style={{
        background: 'oklch(0.14 0.015 260)',
        borderRight: '1px solid oklch(0.30 0.02 260)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid oklch(0.30 0.02 260)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>Messages</div>
          <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 260)', marginTop: '2px' }}>
            {contacts.length} contact{contacts.length > 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {contacts.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: '13px', color: 'oklch(0.52 0.012 260)' }}>
              Aucun contact
            </div>
          ) : (
            contacts.map(contact => (
              <button
                key={contact.user_id}
                onClick={() => setSelectedContact(contact)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', width: '100%', border: 'none',
                  background: selectedContact?.user_id === contact.user_id ? 'oklch(0.20 0.02 260)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                  borderBottom: '1px solid oklch(0.27 0.015 260)',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'oklch(0.30 0.03 255)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
                }}>
                  {contact.username.slice(0, 2).toUpperCase()}
                </div>
                {onlineUsernames.includes(contact.username) && (
                  <span
                    aria-label="En ligne"
                    title="En ligne"
                    style={{
                      position: 'absolute', bottom: '-1px', right: '-1px',
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: 'oklch(0.72 0.14 150)',
                      border: '2px solid oklch(0.14 0.015 260)',
                    }}
                  />
                )}
              </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(0.90 0.005 260)' }}>
                    {contact.username}
                  </div>
                  <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>
                    {contact.role}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation */}
      {selectedContact ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid oklch(0.30 0.02 260)',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'oklch(0.195 0.015 260)',
          }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'oklch(0.30 0.03 255)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: 'oklch(0.85 0.05 255)',
            }}>
              {selectedContact.username.slice(0, 2).toUpperCase()}
            </div>
            {onlineUsernames.includes(selectedContact.username) && (
              <span
                aria-label="En ligne"
                title="En ligne"
                style={{
                  position: 'absolute', bottom: '-1px', right: '-1px',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: 'oklch(0.72 0.14 150)',
                  border: '2px solid oklch(0.14 0.015 260)',
                }}
              />
            )}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'oklch(0.95 0.005 260)' }}>
                {selectedContact.username}
              </div>
              <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 260)' }}>
                {selectedContact.role}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'oklch(0.52 0.012 260)', fontSize: '13px', marginTop: '40px' }}>
                Commencez la conversation
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.sender_id === user?.id;
                const msgDate = new Date(msg.created_at);
                const prevDate = i > 0 ? new Date(messages[i - 1].created_at) : null;
                const showDateSeparator = !prevDate || msgDate.toDateString() !== prevDate.toDateString();

                const formatDateLabel = (d: Date) => {
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(today.getDate() - 1);
                  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
                  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
                  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                };

                return (
                  <div key={msg.id}>
                    {showDateSeparator && (
                      <div style={{
                        textAlign: 'center', fontSize: '11px', fontWeight: 600,
                        color: 'oklch(0.52 0.012 260)', margin: '16px 0 10px',
                      }}>
                        {formatDateLabel(msgDate)}
                      </div>
                    )}
                    <div style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '70%', padding: '10px 14px', borderRadius: '12px',
                        background: isMe ? 'oklch(0.50 0.14 255)' : 'oklch(0.235 0.015 260)',
                        color: 'oklch(0.95 0.005 260)', fontSize: '13px', lineHeight: 1.5,
                      }}>
                        {msg.content}
                      </div>
                      <div style={{ fontSize: '11px', color: 'oklch(0.45 0.01 260)', marginTop: '4px' }}>
                        {msgDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {msg.read_at && isMe && <span style={{ marginLeft: '6px' }}>✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '16px 20px', borderTop: '1px solid oklch(0.30 0.02 260)',
              display: 'flex', gap: '8px',
              background: 'oklch(0.195 0.015 260)',
            }}
          >
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Écrire un message..."
              maxLength={2000}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '8px',
                border: '1px solid oklch(0.34 0.02 260)',
                background: 'oklch(0.16 0.015 260)',
                color: 'oklch(0.95 0.005 260)', fontSize: '13px', outline: 'none',
              }}
            />
            <Button type="submit" loading={sending} disabled={!newMessage.trim()}>
              Envoyer
            </Button>
          </form>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'oklch(0.52 0.012 260)', fontSize: '13px',
        }}>
          Sélectionnez un contact pour commencer
        </div>
      )}
    </div>
  );
}