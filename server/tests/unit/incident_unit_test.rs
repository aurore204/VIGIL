use vigil_server::models::incident::{IncidentSeverity, IncidentState};

#[test]
fn test_incident_state_open_is_not_resolved() {
    assert_ne!(IncidentState::Open, IncidentState::Resolved);
}

#[test]
fn test_incident_severity_equality() {
    assert_eq!(IncidentSeverity::Critical, IncidentSeverity::Critical);
    assert_eq!(IncidentSeverity::Low, IncidentSeverity::Low);
}

#[test]
fn test_valid_state_transition_open_to_acknowledged() {
    let current = IncidentState::Open;
    let next = IncidentState::Acknowledged;
    assert!(validate_transition(&current, &next));
}

#[test]
fn test_valid_state_transition_acknowledged_to_escalated() {
    let current = IncidentState::Acknowledged;
    let next = IncidentState::Escalated;
    assert!(validate_transition(&current, &next));
}

#[test]
fn test_valid_state_transition_escalated_to_resolved() {
    let current = IncidentState::Escalated;
    let next = IncidentState::Resolved;
    assert!(validate_transition(&current, &next));
}

#[test]
fn test_invalid_state_transition_resolved_to_open() {
    let current = IncidentState::Resolved;
    let next = IncidentState::Open;
    assert!(!validate_transition(&current, &next));
}

#[test]
fn test_invalid_state_transition_open_to_escalated() {
    let current = IncidentState::Open;
    let next = IncidentState::Escalated;
    assert!(!validate_transition(&current, &next));
}

#[test]
fn test_invalid_state_transition_resolved_to_acknowledged() {
    let current = IncidentState::Resolved;
    let next = IncidentState::Acknowledged;
    assert!(!validate_transition(&current, &next));
}

// Réplique la logique de validate_state_transition du service
fn validate_transition(current: &IncidentState, next: &IncidentState) -> bool {
    matches!(
        (current, next),
        (IncidentState::Open, IncidentState::Acknowledged)
        | (IncidentState::Acknowledged, IncidentState::Escalated)
        | (IncidentState::Escalated, IncidentState::Resolved)
        | (IncidentState::Acknowledged, IncidentState::Resolved)
        | (IncidentState::Open, IncidentState::Resolved)
    )
}