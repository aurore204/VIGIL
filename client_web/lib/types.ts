// Auth
export interface User {
  id: string;
  email: string;
  username: string;
  language: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Teams
export type TeamRole = "observer" | "responder" | "manager";

export interface TeamMember {
  user_id: string;
  username: string;
  email: string;
  role: TeamRole;
  joined_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  manager_id: string;
  members: TeamMember[];
  created_at: string;
}

export interface TeamInvitation {
  code: string;
}

export interface BannedMember {
  user_id: string;
  username: string;
  email: string;
  banned_by: string;
  banned_by_username: string;
  expires_at: string | null;
  reason: string | null;
  created_at: string;
}

// Incidents
export type IncidentState = "open" | "acknowledged" | "escalated" | "resolved";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface TimelineReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface TimelineEntry {
  id: string;
  incident_id: string;
  author_id: string;
  author_username: string;
  content: string;
  edited_at: string | null;
  created_at: string;
  reactions?: TimelineReaction[];
}

export interface Incident {
  id: string;
  team_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  state: IncidentState;
  severity: IncidentSeverity;
  timeline: TimelineEntry[];
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Releases
export type ReleaseState =
  "created" | "in_progress" | "completed" | "cancelled" | "blocked";
export type StepState = "pending" | "in_progress" | "completed" | "cancelled";

export interface ReleaseStep {
  id: string;
  release_id: string;
  validated_by: string | null;
  name: string;
  description: string | null;
  position: number;
  state: StepState;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Release {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  description: string | null;
  state: ReleaseState;
  steps: ReleaseStep[];
  created_at: string;
  updated_at: string;
}

// Messages privés
export interface PrivateMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  receiver_id: string;
  receiver_username: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

// WebSocket events
export interface WsIncidentStateChanged {
  type: "incident_state_changed";
  incident_id: string;
  new_state: IncidentState;
  by: string;
}

export interface WsIncidentEscalated {
  type: "incident_escalated";
  incident_id: string;
  new_severity: IncidentSeverity;
  by: string;
}

export interface WsIncidentAssigned {
  type: "incident_assigned";
  incident_id: string;
  assigned_to: string;
}

export interface WsTimelineEntryAdded {
  type: "timeline_entry_added";
  incident_id: string;
  entry: {
    content: string;
    author: string;
    at: number;
  };
}

export interface WsTimelineEntryEdited {
  type: "timeline_entry_edited";
  incident_id: string;
  entry_id: string;
  new_content: string;
  edited_at: number;
}

export interface WsPresenceUpdate {
  type: "presence_update";
  resource_id: string;
  resource_type: string;
  watchers: string[];
}

export interface WsReleaseStateChanged {
  type: "release_state_changed";
  release_id: string;
  new_state: ReleaseState;
}

export interface WsReleaseStepValidated {
  type: "release_step_validated";
  release_id: string;
  step: string;
  by: string;
}

export interface WsMemberKicked {
  type: "member_kicked";
  team_id: string;
  member: string;
  by: string;
}

export interface WsMemberBanned {
  type: "member_banned";
  team_id: string;
  member: string;
  until: string | null;
  by: string;
}

export interface WsMemberUnbanned {
  type: "member_unbanned";
  team_id: string;
  member: string;
  by: string;
}

export interface WsMemberJoined {
  type: "member_joined";
  team_id: string;
  member: string;
  role: TeamRole;
}

export interface WsMemberRoleChanged {
  type: "member_role_changed";
  team_id: string;
  member: string;
  new_role: TeamRole;
  by: string;
}

export interface WsManagerTransferred {
  type: "manager_transferred";
  team_id: string;
  new_manager: string;
  previous_manager: string;
}
export interface WsPrivateMessageReceived {
  type: "private_message_received";
  from: string;
  to: string;
  content: string;
  at: number;
}

export interface WsReactionAdded {
  type: "reaction_added";
  incident_id: string;
  entry_id: string;
  emoji: string;
  by: string;
}

export interface WsReactionRemoved {
  type: "reaction_removed";
  incident_id: string;
  entry_id: string;
  emoji: string;
  by: string;
}

export interface WsPresenceOnline {
  type: "presence_online";
  usernames: string[];
}

export interface WsRuleTriggered {
  type: "rule_triggered";
  rule_name: string;
  result: string;
  incident_id: string | null;
}

export interface WsRuleFailed {
  type: "rule_failed";
  rule_name: string;
  error: string;
}

export type WsEvent =
  | WsIncidentStateChanged
  | WsIncidentEscalated
  | WsIncidentAssigned
  | WsTimelineEntryAdded
  | WsTimelineEntryEdited
  | WsPresenceUpdate
  | WsPresenceOnline
  | WsReleaseStateChanged
  | WsReleaseStepValidated
  | WsMemberKicked
  | WsMemberBanned
  | WsMemberUnbanned
  | WsMemberJoined
  | WsMemberRoleChanged
  | WsManagerTransferred
  | WsPrivateMessageReceived
  | WsReactionAdded
  | WsReactionRemoved
  | WsRuleTriggered
  | WsRuleFailed;

// API Response
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
}

export interface Rule {
  id: string;
  team_id: string;
  created_by: string;
  name: string;
  enabled: boolean;
  trigger: {
    service: string;
    event: string;
    filters: Record<string, string>;
  };
  reaction: {
    type: string;
    payload: Record<string, unknown>;
  };
  created_at: string;
  updated_at: string;
}
