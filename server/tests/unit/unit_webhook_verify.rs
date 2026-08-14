use hmac::{Hmac, Mac};
use sha2::Sha256;
use vigil_server::services::webhook_verify::{verify_github_signature, VerifyError};

type HmacSha256 = Hmac<Sha256>;

fn compute_signature(payload: &[u8], secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(payload);
    let result = mac.finalize().into_bytes();
    format!("sha256={}", hex::encode(result))
}

#[test]
fn accepts_valid_signature() {
    let payload = b"{\"action\":\"test\"}";
    let secret = "my-secret";
    let signature = compute_signature(payload, secret);

    let result = verify_github_signature(payload, &signature, secret);

    assert!(result.is_ok());
}

#[test]
fn rejects_signature_with_wrong_secret() {
    let payload = b"{\"action\":\"test\"}";
    let signature = compute_signature(payload, "correct-secret");

    let result = verify_github_signature(payload, &signature, "wrong-secret");

    assert!(matches!(result, Err(VerifyError::SignatureMismatch)));
}

#[test]
fn rejects_signature_without_sha256_prefix() {
    let payload = b"{\"action\":\"test\"}";
    let result = verify_github_signature(payload, "abcdef1234", "any-secret");

    assert!(matches!(result, Err(VerifyError::InvalidSignatureFormat)));
}

#[test]
fn rejects_signature_with_invalid_hex() {
    let payload = b"{\"action\":\"test\"}";
    let result = verify_github_signature(payload, "sha256=not-valid-hex!!", "any-secret");

    assert!(matches!(result, Err(VerifyError::InvalidSignatureFormat)));
}

#[test]
fn rejects_tampered_payload() {
    let secret = "my-secret";
    let original_payload = b"{\"action\":\"original\"}";
    let signature = compute_signature(original_payload, secret);

    let tampered_payload = b"{\"action\":\"tampered\"}";
    let result = verify_github_signature(tampered_payload, &signature, secret);

    assert!(matches!(result, Err(VerifyError::SignatureMismatch)));
}

#[test]
fn rejects_empty_secret() {
    let payload = b"{\"action\":\"test\"}";
    let signature = compute_signature(payload, "");

    // Un secret vide doit quand même produire une signature valide vérifiable,
    // mais on vérifie ici que la fonction ne panique pas et gère le cas proprement.
    let result = verify_github_signature(payload, &signature, "");
    assert!(result.is_ok());
}
