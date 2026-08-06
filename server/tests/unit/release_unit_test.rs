use vigil_server::models::release::{ReleaseState, StepState};

#[test]
fn test_release_state_equality() {
    assert_eq!(ReleaseState::Created, ReleaseState::Created);
    assert_eq!(ReleaseState::InProgress, ReleaseState::InProgress);
    assert_eq!(ReleaseState::Completed, ReleaseState::Completed);
    assert_eq!(ReleaseState::Cancelled, ReleaseState::Cancelled);
    assert_eq!(ReleaseState::Blocked, ReleaseState::Blocked);
}

#[test]
fn test_release_state_not_equal() {
    assert_ne!(ReleaseState::Created, ReleaseState::Completed);
    assert_ne!(ReleaseState::Blocked, ReleaseState::InProgress);
}

#[test]
fn test_step_state_equality() {
    assert_eq!(StepState::Pending, StepState::Pending);
    assert_eq!(StepState::Completed, StepState::Completed);
}

#[test]
fn test_blocked_state_is_not_completed() {
    assert_ne!(ReleaseState::Blocked, ReleaseState::Completed);
}

#[test]
fn test_cancelled_state_is_not_completed() {
    assert_ne!(ReleaseState::Cancelled, ReleaseState::Completed);
}
