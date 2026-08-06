use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// Tous les événements WebSocket possibles
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsEvent {
    // Phase 1 core
    IncidentStateChanged {
        incident_id: Uuid,
        new_state: String,
        by: String,
    },
    IncidentEscalated {
        incident_id: Uuid,
        new_severity: String,
        by: String,
    },
    IncidentAssigned {
        incident_id: Uuid,
        assigned_to: String,
    },
    TimelineEntryAdded {
        incident_id: Uuid,
        entry: TimelineEntryPayload,
    },
    PresenceUpdate {
        resource_id: Uuid,
        resource_type: String,
        watchers: Vec<String>,
    },
    // Phase 1 extended
    MemberKicked {
        team_id: Uuid,
        member: String,
        by: String,
    },
    MemberBanned {
        team_id: Uuid,
        member: String,
        until: Option<DateTime<Utc>>,
        by: String,
    },
    MemberUnbanned {
        team_id: Uuid,
        member: String,
        by: String,
    },
    TimelineEntryEdited {
        incident_id: Uuid,
        entry_id: Uuid,
        new_content: String,
        edited_at: DateTime<Utc>,
    },
    PrivateMessageReceived {
        from: String,
        to: String,
        content: String,
        at: DateTime<Utc>,
    },
    ReactionAdded {
        incident_id: Uuid,
        entry_id: Uuid,
        emoji: String,
        by: String,
    },
    ReactionRemoved {
        incident_id: Uuid,
        entry_id: Uuid,
        emoji: String,
        by: String,
    },
    ReleaseStepValidated {
        release_id: Uuid,
        step: String,
        by: String,
    },
    ReleaseStateChanged {
        release_id: Uuid,
        new_state: String,
    },

    PresenceOnline {
        usernames: Vec<String>,
    },

    // Phase 2
    RuleTriggered {
        rule_name: String,
        result: String,
        incident_id: Option<Uuid>,
    },
    RuleFailed {
        rule_name: String,
        error: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEntryPayload {
    pub content: String,
    pub author: String,
    pub at: DateTime<Utc>,
}
