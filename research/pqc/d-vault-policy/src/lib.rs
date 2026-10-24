//! D-stage OFF-CHAIN policy prototype, NOT a Solana vault or Falcon verifier.
//! All values are fixed-size byte arrays to avoid ambiguous serialization.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Withdrawal {
    pub genesis_hash: [u8;32],
    pub program_id: [u8;32],
    pub vault_id: [u8;32],
    pub mint: [u8;32],
    pub destination: [u8;32],
    pub amount: u64,
    pub nonce: u64,
    pub expiry_unix: u64,
    pub key_version: u32,
}
#[derive(Debug,Clone,PartialEq,Eq)]
pub enum PolicyError { WrongDomain, WrongVault, WrongMint, WrongKeyVersion, ZeroAmount, Expired, Replay, SignatureNotVerified }
#[derive(Debug,Clone)]
pub struct PolicyContext {
    pub genesis_hash:[u8;32], pub program_id:[u8;32], pub vault_id:[u8;32],
    pub mint:[u8;32], pub key_version:u32, pub next_nonce:u64,
}
impl Withdrawal {
    pub fn canonical_bytes(&self)->Vec<u8> {
        let mut b=b"SHAH-CAT/QUANTUM-VAULT/WITHDRAW/v1\n".to_vec();
        for field in [self.genesis_hash,self.program_id,self.vault_id,self.mint,self.destination] { b.extend_from_slice(&field); }
        b.extend_from_slice(&self.amount.to_le_bytes());
        b.extend_from_slice(&self.nonce.to_le_bytes());
        b.extend_from_slice(&self.expiry_unix.to_le_bytes());
        b.extend_from_slice(&self.key_version.to_le_bytes());
        b
    }
}
/// Fails closed. The boolean is a placeholder for a *future trusted on-chain* verifier result,
/// and MUST NOT be provided by a wallet/frontend or used for custody in production.
pub fn evaluate(w:&Withdrawal,c:&PolicyContext,now:u64,verified_on_chain:bool)->Result<u64,PolicyError>{
    if w.genesis_hash!=c.genesis_hash || w.program_id!=c.program_id {return Err(PolicyError::WrongDomain)}
    if w.vault_id!=c.vault_id{return Err(PolicyError::WrongVault)}
    if w.mint!=c.mint{return Err(PolicyError::WrongMint)}
    if w.key_version!=c.key_version{return Err(PolicyError::WrongKeyVersion)}
    if w.amount==0{return Err(PolicyError::ZeroAmount)}
    if now>=w.expiry_unix{return Err(PolicyError::Expired)}
    if w.nonce!=c.next_nonce{return Err(PolicyError::Replay)}
    if !verified_on_chain{return Err(PolicyError::SignatureNotVerified)}
    c.next_nonce.checked_add(1).ok_or(PolicyError::Replay)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn sample()->(Withdrawal,PolicyContext){
        let w=Withdrawal{genesis_hash:[1;32],program_id:[2;32],vault_id:[3;32],mint:[4;32],destination:[5;32],amount:100,nonce:0,expiry_unix:200,key_version:1};
        let c=PolicyContext{genesis_hash:[1;32],program_id:[2;32],vault_id:[3;32],mint:[4;32],key_version:1,next_nonce:0};
        (w,c)
    }
    #[test] fn unsigned_fails_closed(){let(w,c)=sample();assert_eq!(evaluate(&w,&c,100,false),Err(PolicyError::SignatureNotVerified));}
    #[test] fn valid_policy_only(){let(w,c)=sample();assert_eq!(evaluate(&w,&c,100,true),Ok(1));}
    #[test] fn replay_rejected(){let(mut w,mut c)=sample();c.next_nonce=1;assert_eq!(evaluate(&w,&c,100,true),Err(PolicyError::Replay));w.nonce=1;assert_eq!(evaluate(&w,&c,100,true),Ok(2));}
    #[test] fn wrong_domain_rejected(){let(mut w,c)=sample();w.genesis_hash[0]=0;assert_eq!(evaluate(&w,&c,100,true),Err(PolicyError::WrongDomain));}
    #[test] fn wrong_vault_rejected(){let(mut w,c)=sample();w.vault_id[0]=0;assert_eq!(evaluate(&w,&c,100,true),Err(PolicyError::WrongVault));}
    #[test] fn wrong_mint_rejected(){let(mut w,c)=sample();w.mint[0]=0;assert_eq!(evaluate(&w,&c,100,true),Err(PolicyError::WrongMint));}
    #[test] fn expired_rejected(){let(w,c)=sample();assert_eq!(evaluate(&w,&c,200,true),Err(PolicyError::Expired));}
    #[test] fn zero_amount_rejected(){let(mut w,c)=sample();w.amount=0;assert_eq!(evaluate(&w,&c,100,true),Err(PolicyError::ZeroAmount));}
    #[test] fn key_version_rejected(){let(mut w,c)=sample();w.key_version=2;assert_eq!(evaluate(&w,&c,100,true),Err(PolicyError::WrongKeyVersion));}
    #[test] fn destination_is_signed(){let(mut w,_)=sample();let a=w.canonical_bytes();w.destination[0]^=1;assert_ne!(a,w.canonical_bytes());}
}
