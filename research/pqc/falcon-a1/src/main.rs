//! SHAH CAT A1: off-chain Tidecoin legacy Falcon-512 verification demo.
//! Use only ephemeral OS-generated keys; never production wallet secrets.
use rand_core::OsRng;
use tide_fn_dsa::{
    FalconProfile, KeyPairGenerator, KeyPairGeneratorStandard,
    SigningKey, SigningKeyStandard, VerifyingKey, VerifyingKeyStandard,
    FN_DSA_LOGN_512, SIGN_KEY_SIZE_512, VRFY_KEY_SIZE_512,
    TIDECOIN_LEGACY_FALCON512_SIG_MAX,
};

fn main() {
    let mut rng = OsRng;
    let mut generator = KeyPairGeneratorStandard::default();
    let mut secret = [0u8; SIGN_KEY_SIZE_512];
    let mut public = [0u8; VRFY_KEY_SIZE_512];
    generator.keygen(FN_DSA_LOGN_512, &mut rng, &mut secret, &mut public)
        .expect("key generation failed");

    let mut signer = SigningKeyStandard::decode(&secret).expect("invalid secret key");
    let verifier = VerifyingKeyStandard::decode(&public).expect("invalid public key");
    // Domain-separated project-specific context. This is NOT a Solana transaction.
    let message = b"SHAH-CAT/PQC-A1/v1|devnet|release-demo|sha256:example";
    let mut signature = [0u8; TIDECOIN_LEGACY_FALCON512_SIG_MAX];
    let length = signer.sign_falcon(
        &mut rng, FalconProfile::TidecoinLegacyFalcon512, message, &mut signature,
    ).expect("signing failed");
    let sig = &signature[..length];
    assert!(verifier.verify_falcon(FalconProfile::TidecoinLegacyFalcon512, sig, message));
    assert!(!verifier.verify_falcon(FalconProfile::TidecoinLegacyFalcon512, sig, b"SHAH-CAT/PQC-A1/v1|devnet|release-demo|sha256:tampered"));
    let mut modified = sig.to_vec();
    modified[length - 1] ^= 1;
    assert!(!verifier.verify_falcon(FalconProfile::TidecoinLegacyFalcon512, &modified, message));
    println!("PASS: valid signature accepted; changed message and signature rejected");
    println!("Signature length: {length} bytes");
    // Do not print secret keys or persist them.
}
