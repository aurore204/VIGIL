use vigil_server::models::reaction::AVAILABLE_EMOJIS;
use vigil_server::services::reaction_service::get_available_emojis;

#[test]
fn test_available_emojis_contains_required_emojis() {
    assert!(AVAILABLE_EMOJIS.contains(&"+1"));
    assert!(AVAILABLE_EMOJIS.contains(&"-1"));
    assert!(AVAILABLE_EMOJIS.contains(&"fire"));
    assert!(AVAILABLE_EMOJIS.contains(&"check"));
}

#[test]
fn test_available_emojis_count_between_5_and_8() {
    assert!(AVAILABLE_EMOJIS.len() >= 5);
    assert!(AVAILABLE_EMOJIS.len() <= 8);
}

#[test]
fn test_get_available_emojis_returns_all() {
    let emojis = get_available_emojis();
    assert_eq!(emojis.len(), AVAILABLE_EMOJIS.len());
}

#[test]
fn test_invalid_emoji_not_in_available() {
    assert!(!AVAILABLE_EMOJIS.contains(&"invalid_emoji"));
    assert!(!AVAILABLE_EMOJIS.contains(&""));
}