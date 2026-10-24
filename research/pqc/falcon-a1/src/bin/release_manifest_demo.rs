//! SHAH CAT B1: ephemeral release-manifest signature demo (NOT a production signer).
use rand_core::OsRng;
use tide_fn_dsa::{
    FalconProfile, KeyPairGenerator, KeyPairGeneratorStandard,
    SigningKey, SigningKeyStandard, VerifyingKey, VerifyingKeyStandard,
    FN_DSA_LOGN_512, SIGN_KEY_SIZE_512, VRFY_KEY_SIZE_512,
    TIDECOIN_LEGACY_FALCON512_SIG_MAX,
};

const PROFILE: FalconProfile = FalconProfile::TidecoinLegacyFalcon512;
const ARTIFACT_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // SHA-256(empty bytes), DEMO ONLY

fn manifest(hash: &str, expires: u64) -> Vec<u8> {
    format!(
        "SHAH-CAT/RELEASE-MANIFEST/v1\nproject=shah-cat\nnetwork=devnet\nversion=0.1.0\nartifact_sha256={hash}\ncreated_unix=1700000000\nexpires_unix={expires}\n"
    ).into_bytes()
}

fn valid_format(data: &[u8], now: u64) -> bool {
    let Ok(text) = std::str::from_utf8(data) else { return false };
    let fields: Vec<&str> = text.split_terminator('\n').collect();
    if fields.len() != 7 || fields[0] != "SHAH-CAT/RELEASE-MANIFEST/v1"
        || fields[1] != "project=shah-cat" || fields[2] != "network=devnet"
        || fields[3] != "version=0.1.0" { return false }
    let Some(hash) = fields[4].strip_prefix("artifact_sha256=") else { return false };
    if hash.len() != 64 || !hash.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)) { return false }
    let Some(created) = fields[5].strip_prefix("created_unix=").and_then(|x| x.parse::<u64>().ok()) else { return false };
    let Some(expires) = fields[6].strip_prefix("expires_unix=").and_then(|x| x.parse::<u64>().ok()) else { return false };
    data.last() == Some(&b'\n') && created <= now && now < expires && created < expires
}

fn main() {
    let mut rng = OsRng;
    let mut generator = KeyPairGeneratorStandard::default();
    let mut secret = [0u8; SIGN_KEY_SIZE_512];
    let mut public = [0u8; VRFY_KEY_SIZE_512];
    generator.keygen(FN_DSA_LOGN_512, &mut rng, &mut secret, &mut public).expect("keygen");
    let mut signer = SigningKeyStandard::decode(&secret).expect("secret decode");
    let verifier = VerifyingKeyStandard::decode(&public).expect("public decode");
    let payload = manifest(ARTIFACT_HASH, 1900000000);
    let mut signature = [0u8; TIDECOIN_LEGACY_FALCON512_SIG_MAX];
    let len = signer.sign_falcon(&mut rng, PROFILE, &payload, &mut signature).expect("sign");
    let sig = &signature[..len];
    let now = 1800000000;
    assert!(valid_format(&payload, now) && verifier.verify_falcon(PROFILE, sig, &payload));
    let changed = manifest("0000000000000000000000000000000000000000000000000000000000000000", 1900000000);
    assert!(!verifier.verify_falcon(PROFILE, sig, &changed));
    let expired = manifest(ARTIFACT_HASH, 1700000001);
    assert!(!valid_format(&expired, now));
    let wrong_network = String::from_utf8(payload.clone()).unwrap().replace("network=devnet", "network=mainnet");
    assert!(!valid_format(wrong_network.as_bytes(), now));
    assert!(!verifier.verify_falcon(PROFILE, sig, wrong_network.as_bytes()));
    println!("PASS: B1 ephemeral manifest signature verified; tampering, wrong network, and expiry rejected");
    println!("Demo public key length: {} bytes; signature length: {} bytes", public.len(), len);
    // Deliberately do not print/store private keys or claim a trusted release identity.
}
