use vigil_server::models::message::MAX_MESSAGE_LENGTH;

#[test]
fn test_max_message_length_is_2000() {
    assert_eq!(MAX_MESSAGE_LENGTH, 2000);
}

#[test]
fn test_content_within_limit_is_valid() {
    let content = "a".repeat(2000);
    assert!(content.len() <= MAX_MESSAGE_LENGTH);
}

#[test]
fn test_content_exceeding_limit_is_invalid() {
    let content = "a".repeat(2001);
    assert!(content.len() > MAX_MESSAGE_LENGTH);
}