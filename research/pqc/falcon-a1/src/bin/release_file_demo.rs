//! B2 experimental real-file hash + Falcon manifest signature + independent verification.
//! Ephemeral demo keys only. Does NOT establish an authenticated SHAH release identity.
use std::{env,fs,path::Path,time::{SystemTime,UNIX_EPOCH}};
use rand_core::OsRng;
use sha2::{Digest,Sha256};
use tide_fn_dsa::{FalconProfile,KeyPairGenerator,KeyPairGeneratorStandard,SigningKey,SigningKeyStandard,VerifyingKey,VerifyingKeyStandard,FN_DSA_LOGN_512,SIGN_KEY_SIZE_512,VRFY_KEY_SIZE_512,TIDECOIN_LEGACY_FALCON512_SIG_MAX};
const PROFILE:FalconProfile=FalconProfile::TidecoinLegacyFalcon512;
fn hex(bytes:&[u8])->String{bytes.iter().map(|b|format!("{b:02x}")).collect()}
fn unhex(s:&str)->Result<Vec<u8>,String>{if s.len()%2!=0{return Err("odd hex length".into())} (0..s.len()).step_by(2).map(|i|u8::from_str_radix(&s[i..i+2],16).map_err(|_|"invalid hex".into())).collect()}
fn now()->u64{SystemTime::now().duration_since(UNIX_EPOCH).expect("clock").as_secs()}
fn manifest(hash:&str,created:u64,expires:u64)->Vec<u8>{format!("SHAH-CAT/RELEASE-MANIFEST/v1\nproject=shah-cat\nnetwork=devnet\nversion=0.2.0\nartifact_sha256={hash}\ncreated_unix={created}\nexpires_unix={expires}\n").into_bytes()}
fn valid(m:&[u8],hash:&str,t:u64)->bool{
let Ok(s)=std::str::from_utf8(m) else{return false};
let lines:Vec<_>=s.split_terminator('\n').collect();
if lines.len()!=7||m.last()!=Some(&b'\n')||lines[0]!="SHAH-CAT/RELEASE-MANIFEST/v1"||lines[1]!="project=shah-cat"||lines[2]!="network=devnet"||lines[3]!="version=0.2.0"||lines[4]!=format!("artifact_sha256={hash}"){return false}
let Some(c)=lines[5].strip_prefix("created_unix=").and_then(|x|x.parse::<u64>().ok()) else{return false};
let Some(e)=lines[6].strip_prefix("expires_unix=").and_then(|x|x.parse::<u64>().ok()) else{return false};
c<=t&&t<e&&c<e
}
fn verify(file:&Path,dir:&Path,t:u64)->Result<(),String>{
let hash=hex(&Sha256::digest(fs::read(file).map_err(|e|e.to_string())?));
let m=fs::read(dir.join("manifest.txt")).map_err(|e|e.to_string())?;
if !valid(&m,&hash,t){return Err("artifact hash, manifest context, or validity window mismatch".into())}
let pubkey=unhex(&fs::read_to_string(dir.join("public-key.hex")).map_err(|e|e.to_string())?.trim())?;
let sig=unhex(&fs::read_to_string(dir.join("signature.hex")).map_err(|e|e.to_string())?.trim())?;
let key=VerifyingKeyStandard::decode(&pubkey).map_err(|_|"invalid public key")?;
if !key.verify_falcon(PROFILE,&sig,&m){return Err("Falcon signature mismatch".into())}
Ok(())
}
fn run()->Result<(),String>{
let args:Vec<_>=env::args().collect();
if args.len()!=4{return Err("Usage: release_file_demo sign|verify <artifact-file> <output-directory>".into())}
let file=Path::new(&args[2]);let dir=Path::new(&args[3]);
if args[1]=="verify"{verify(file,dir,now())?;println!("PASS: artifact hash and Falcon manifest signature verified (demo key; trust NOT established)");return Ok(())}
if args[1]!="sign"{return Err("expected sign or verify".into())}
fs::create_dir_all(dir).map_err(|e|e.to_string())?;
for name in ["manifest.txt","public-key.hex","signature.hex"]{if dir.join(name).exists(){return Err(format!("refusing to overwrite {name}"))}}
let hash=hex(&Sha256::digest(fs::read(file).map_err(|e|e.to_string())?));
let created=now();let m=manifest(&hash,created,created+86400);
let mut rng=OsRng;let mut generator=KeyPairGeneratorStandard::default();
let mut secret=[0u8;SIGN_KEY_SIZE_512];let mut public=[0u8;VRFY_KEY_SIZE_512];
generator.keygen(FN_DSA_LOGN_512,&mut rng,&mut secret,&mut public).map_err(|_|"keygen failed")?;
let mut signer=SigningKeyStandard::decode(&secret).map_err(|_|"invalid secret key")?;
let mut sig=[0u8;TIDECOIN_LEGACY_FALCON512_SIG_MAX];
let len=signer.sign_falcon(&mut rng,PROFILE,&m,&mut sig).map_err(|_|"sign failed")?;
fs::write(dir.join("manifest.txt"),&m).map_err(|e|e.to_string())?;
fs::write(dir.join("public-key.hex"),hex(&public)).map_err(|e|e.to_string())?;
fs::write(dir.join("signature.hex"),hex(&sig[..len])).map_err(|e|e.to_string())?;
verify(file,dir,now())?;
println!("PASS: signed real file and verified manifest (ephemeral key; not an official release)");
Ok(())
}
fn main(){if let Err(e)=run(){eprintln!("FAIL: {e}");std::process::exit(1)}}
