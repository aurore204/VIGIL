use chrono::Utc;
use uuid::Uuid;
use vigil_server::websocket::events::{TimelineEntryPayload, WsEvent};

#[test]
fn test_incident_state_changed_serializes_correctly() {
    let event = WsEvent::IncidentStateChanged {
        incident_id: Uuid::new_v4(),
        new_state: "acknowledged".to_string(),
        by: "alice".to_string(),
    };
    let json = serde_json::to_string(&event).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "incident_state_changed");
    assert_eq!(parsed["new_state"], "acknowledged");
    assert_eq!(parsed["by"], "alice");
}

#[test]
fn test_incident_escalated_serializes_correctly() {
    let event = WsEvent::IncidentEscalated {
        incident_id: Uuid::new_v4(),
        new_severity: "critical".to_string(),
        by: "bob".to_string(),
    };
    let json = serde_json::to_string(&event).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "incident_escalated");
    assert_eq!(parsed["new_severity"], "critical");
}

#[test]
fn test_incident_assigned_serializes_correctly() {
    let event = WsEvent::IncidentAssigned {
        incident_id: Uuid::new_v4(),
        assigned_to: "alice".to_string(),
    };
    let json = serde_json::to_string(&event).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "incident_assigned");
    assert_eq!(parsed["assigned_to"], "alice");
}

#[test]
fn test_timeline_entry_added_serializes_correctly() {
    let event = WsEvent::TimelineEntryAdded {
        incident_id: Uuid::new_v4(),
        entry: TimelineEntryPayload {
            content: "Investigation en cours".to_string(),
            author: "alice".to_string(),
            at: Utc::now(),
        },
    };
    let json = serde_json::to_string(&event).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "timeline_entry_added");
    assert_eq!(parsed["entry"]["content"], "Investigation en cours");
    assert_eq!(parsed["entry"]["author"], "alice");
}

#[test]
fn test_presence_update_serializes_correctly() {
    let event = WsEvent::PresenceUpdate {
        resource_id: Uuid::new_v4(),
        resource_type: "incident".to_string(),
        watchers: vec!["alice".to_string(), "bob".to_string()],
    };
    let json = serde_json::to_string(&event).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "presence_update");
    assert_eq!(parsed["resource_type"], "incident");
    assert_eq!(parsed["watchers"].as_array().unwrap().len(), 2);
}

#[test]
fn test_timeline_entry_edited_serializes_correctly() {
    let event = WsEvent::TimelineEntryEdited {
        incident_id: Uuid::new_v4(),
        entry_id: Uuid::new_v4(),
        new_content: "Contenu modifié".to_string(),
        edited_at: Utc::now(),
    };
    let json = serde_json::to_string(&event).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["type"], "timeline_entry_edited");
    assert_eq!(parsed["new_content"], "Contenu modifié");
}
