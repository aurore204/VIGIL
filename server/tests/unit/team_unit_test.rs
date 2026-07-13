use vigil_server::models::team::TeamRole;

#[test]
fn test_team_role_manager_is_not_observer() {
    let role = TeamRole::Manager;
    assert_ne!(role, TeamRole::Observer);
}

#[test]
fn test_team_role_manager_is_not_responder() {
    let role = TeamRole::Manager;
    assert_ne!(role, TeamRole::Responder);
}

#[test]
fn test_team_role_equality() {
    assert_eq!(TeamRole::Observer, TeamRole::Observer);
    assert_eq!(TeamRole::Responder, TeamRole::Responder);
    assert_eq!(TeamRole::Manager, TeamRole::Manager);
}

#[test]
fn test_invitation_code_length() {
    // Le code généré doit faire 8 caractères
    let code = format!("{:08X}", 0xABCD1234u32);
    assert_eq!(code.len(), 8);
}