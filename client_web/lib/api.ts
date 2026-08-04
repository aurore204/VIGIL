import type { AuthResponse, Team, Incident, Release, PrivateMessage,BannedMember } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('vigil_token')
    : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue');
  }

  return data.data;
}

export const api = {
  // Auth
  register: (email: string, password: string, username: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<AuthResponse['user']>('/me'),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  // Teams
  getTeams: () => request<Team[]>('/teams'),

  createTeam: (name: string, description?: string) =>
    request<Team>('/teams', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  getTeam: (teamId: string) => request<Team>(`/teams/${teamId}`),

  updateTeam: (teamId: string, data: { name?: string; description?: string }) =>
    request<Team>(`/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTeam: (teamId: string) =>
    request<void>(`/teams/${teamId}`, { method: 'DELETE' }),

  joinTeam: (code: string) =>
    request<Team>('/teams/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  leaveTeam: (teamId: string) =>
    request<void>(`/teams/${teamId}/leave`, { method: 'DELETE' }),

  generateInvitation: (teamId: string) =>
    request<{ code: string }>(`/teams/${teamId}/invitations`, { method: 'POST' }),

  transferManager: (teamId: string, userId: string) =>
    request<Team>(`/teams/${teamId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  updateMemberRole: (teamId: string, userId: string, role: string) =>
    request<void>(`/teams/${teamId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  kickMember: (teamId: string, userId: string) =>
    request<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),

  banMember: (teamId: string, userId: string, expiresAt?: string, reason?: string) =>
    request<void>(`/teams/${teamId}/members/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ expires_at: expiresAt, reason }),
    }),

  unbanMember: (teamId: string, userId: string) =>
    request<void>(`/teams/${teamId}/members/${userId}/ban`, { method: 'DELETE' }),
  
  getBannedMembers: (teamId: string) =>
    request<BannedMember[]>(`/teams/${teamId}/bans`),
  // Incidents
  getIncidents: (teamId: string) =>
    request<Incident[]>(`/teams/${teamId}/incidents`),

  createIncident: (teamId: string, data: { title: string; description?: string; severity: string }) =>
    request<Incident>(`/teams/${teamId}/incidents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getIncident: (incidentId: string) =>
    request<Incident>(`/incidents/${incidentId}`),

  updateIncident: (incidentId: string, data: { title?: string; description?: string; severity?: string }) =>
    request<Incident>(`/incidents/${incidentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteIncident: (incidentId: string) =>
    request<void>(`/incidents/${incidentId}`, { method: 'DELETE' }),
  
  acknowledgeIncident: (incidentId: string) =>
    request<Incident>(`/incidents/${incidentId}/acknowledge`, { method: 'PATCH' }),

  escalateIncident: (incidentId: string, severity: string) =>
    request<Incident>(`/incidents/${incidentId}/escalate`, {
      method: 'PATCH',
      body: JSON.stringify({ severity }),
    }),

  resolveIncident: (incidentId: string) =>
    request<Incident>(`/incidents/${incidentId}/resolve`, { method: 'PATCH' }),

  assignResponder: (incidentId: string, userId: string) =>
    request<Incident>(`/incidents/${incidentId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  addTimelineEntry: (incidentId: string, content: string) =>
    request<Incident>(`/incidents/${incidentId}/timeline`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  editTimelineEntry: (incidentId: string, entryId: string, content: string) =>
    request<Incident>(`/incidents/${incidentId}/timeline/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  // Réactions
  getAvailableReactions: () => request<string[]>('/reactions/available'),

  addReaction: (incidentId: string, entryId: string, emoji: string) =>
    request<void>(`/incidents/${incidentId}/timeline/${entryId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  removeReaction: (incidentId: string, entryId: string, emoji: string) =>
    request<void>(`/incidents/${incidentId}/timeline/${entryId}/reactions/${emoji}`, {
      method: 'DELETE',
    }),

  // Releases
  getReleases: (teamId: string) =>
    request<Release[]>(`/teams/${teamId}/releases`),

  createRelease: (teamId: string, data: {
    title: string;
    description?: string;
    steps: { name: string; description?: string }[]
  }) =>
    request<Release>(`/teams/${teamId}/releases`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getRelease: (releaseId: string) =>
    request<Release>(`/releases/${releaseId}`),

  startRelease: (releaseId: string) =>
    request<Release>(`/releases/${releaseId}/start`, { method: 'PATCH' }),

  cancelRelease: (releaseId: string) =>
    request<void>(`/releases/${releaseId}/cancel`, { method: 'PATCH' }),

  validateStep: (releaseId: string, stepId: string) =>
    request<Release>(`/releases/${releaseId}/steps/${stepId}/validate`, { method: 'PATCH' }),

  // Présence
  getOnlineUsers: () => request<string[]>('/presence/online'),

  
  // Messages privés
  sendMessage: (userId: string, content: string) =>
    request<PrivateMessage>(`/users/${userId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  getConversation: (userId: string) =>
    request<PrivateMessage[]>(`/users/${userId}/messages`),

  markAsRead: (messageId: string) =>
    request<void>(`/messages/${messageId}/read`, { method: 'PATCH' }),
  
  
};