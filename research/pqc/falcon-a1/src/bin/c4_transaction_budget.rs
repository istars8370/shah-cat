//! C4: measure Falcon-512 payload size BEFORE attempting local-validator execution.
//! This is an off-chain feasibility gate, not a transaction or on-chain benchmark.
use rand_core::OsRng;
use tide_fn_dsa::{
    FalconProfile, KeyPairGenerator, KeyPairGeneratorStandard,
    SigningKey, SigningKeyStandard, FN_DSA_LOGN_512,
    SIGN_KEY_SIZE_512, VRFY_KEY_SIZE_512, TIDECOIN_LEGACY_FALCON512_SIG_MAX,
};
const SOLANA_TX_LIMIT: usize = 1232;
fn main() {
    let mut rng = OsRng;
    let mut generator = KeyPairGeneratorStandard::default();
    let mut secret = [0u8; SIGN_KEY_SIZE_512];
    let mut public = [0u8; VRFY_KEY_SIZE_512];
    generator.keygen(FN_DSA_LOGN_512, &mut rng, &mut secret, &mut public)
        .expect("key generation");
    let mut signer = SigningKeyStandard::decode(&secret).expect("secret decode");
    let message = b"SHAH-CAT/C4/TRANSACTION-SIZE/TEST";
    let mut signature = [0u8; TIDECOIN_LEGACY_FALCON512_SIG_MAX];
    let sig_len = signer.sign_falcon(
        &mut rng, FalconProfile::TidecoinLegacyFalcon512,
        message, &mut signature
    ).expect("signing");
    // Current C3 instruction: discriminator(4), three u16 lengths(6),
    // public key, signature, message. This EXCLUDES all Solana tx overhead.
    let inline_bytes = 10 + public.len() + sig_len + message.len();
    let stored_key_bytes = 10 + sig_len + message.len();
    println!("Falcon public key: {} bytes", public.len());
    println!("Falcon signature: {} bytes", sig_len);
    println!("C3 inline-key instruction payload: {} bytes", inline_bytes);
    println!("C3 stored-key hypothetical payload: {} bytes", stored_key_bytes);
    println!("Solana transaction serialization ceiling: {} bytes", SOLANA_TX_LIMIT);
    assert!(inline_bytes > SOLANA_TX_LIMIT,
        "Unexpected size: re-evaluate inline-key assumption and transaction overhead");
    println!("PASS: inline-key format exceeds transaction limit even before transaction overhead");
    if stored_key_bytes >= SOLANA_TX_LIMIT {
        println!("NOTE: stored-key payload alone also exceeds the transaction limit");
    } else {
        println!("NOTE: stored-key payload might fit, but full serialized transaction must be measured");
    }
}
