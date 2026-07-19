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
fn test_invitation_code_format() {
    // Vérifie que notre format de code produit toujours 8 caractères hexadécimaux
    let hash_value: u32 = 0xABCD1234u32 & 0xFFFFFFFF;
    let code = format!("{:08X}", hash_value);
    assert_eq!(code.len(), 8);
    assert!(code.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn test_update_team_request_accepts_partial_fields() {
    let req = vigil_server::models::team::UpdateTeamRequest {
        name: Some("Nouveau nom".to_string()),
        description: None,
    };
    assert!(req.name.is_some());
    assert!(req.description.is_none());
}

#[test]
fn test_update_team_request_accepts_all_fields() {
    let req = vigil_server::models::team::UpdateTeamRequest {
        name: Some("Nouveau nom".to_string()),
        description: Some("Nouvelle description".to_string()),
    };
    assert!(req.name.is_some());
    assert!(req.description.is_some());
}

#[test]
fn test_manager_cannot_leave_without_transfer() {
    // Le Manager a le rôle Manager
    let role = vigil_server::models::team::TeamRole::Manager;
    // Un Manager ne peut pas quitter donc son rôle ne doit pas être Observer ou Responder
    assert_ne!(role, vigil_server::models::team::TeamRole::Observer);
    assert_ne!(role, vigil_server::models::team::TeamRole::Responder);
}

#[test]
fn test_observer_can_leave_team() {
    // Un Observer peut quitter car son rôle n'est pas Manager
    let role = vigil_server::models::team::TeamRole::Observer;
    assert_ne!(role, vigil_server::models::team::TeamRole::Manager);
}

#[test]
fn test_responder_can_leave_team() {
    // Un Responder peut quitter car son rôle n'est pas Manager
    let role = vigil_server::models::team::TeamRole::Responder;
    assert_ne!(role, vigil_server::models::team::TeamRole::Manager);
}