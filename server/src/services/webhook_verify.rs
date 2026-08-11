use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug)]
pub enum VerifyError {
    InvalidSignatureFormat,
    InvalidSecret,
    SignatureMismatch,
}

//Vérifie qu'un payload webhook a bien été signé avec le secret attendu.

pub fn verify_github_signature(
    payload: &[u8],
    signature_header: &str,
    secret: &str,
) -> Result<(), VerifyError> {
    let expected_hex = signature_header
        .strip_prefix("sha256=")
        .ok_or(VerifyError::InvalidSignatureFormat)?;

    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| VerifyError::InvalidSecret)?;
    mac.update(payload);

    let expected_bytes =
        hex::decode(expected_hex).map_err(|_| VerifyError::InvalidSignatureFormat)?;

    // verify_slice fait une comparaison en temps constant 
    mac.verify_slice(&expected_bytes)
        .map_err(|_| VerifyError::SignatureMismatch)
}
