//! SHAH CAT Guardian G1 — state-only Solana research program.
//!
//! Scope:
//! - create a deterministic Guardian config PDA
//! - persist owner, mint, guardian set and recovery-state fields
//! - validate threshold and unique guardians
//!
//! Explicitly out of scope:
//! - token custody or token movement
//! - recovery execution
//! - Falcon/PQC authorization
//! - Treasury integration
//! - mainnet deployment

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::{invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    system_program,
    sysvar::Sysvar,
};

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

pub const CONFIG_SEED: &[u8] = b"guardian-config";
pub const STATE_DISCRIMINATOR: &[u8; 8] = b"SHAGRD01";
pub const STATE_VERSION: u8 = 2;
pub const MAX_GUARDIANS: usize = 5;
pub const STATE_LEN: usize = 342;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GuardianState {
    pub version: u8,
    pub bump: u8,
    pub threshold: u8,
    pub guardian_count: u8,
    pub guardian_set_version: u64,
    pub recovery_nonce: u64,
    pub config_seed: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub pending_owner: Pubkey,
    pub recovery_active: bool,
    pub initiated_at: i64,
    pub executable_after: i64,
    pub expires_at: i64,
    pub frozen: bool,
    pub guardians: [Pubkey; MAX_GUARDIANS],
}

impl GuardianState {
    pub fn new(
        bump: u8,
        owner: Pubkey,
        mint: Pubkey,
        threshold: u8,
        guardians: &[Pubkey],
    ) -> Result<Self, ProgramError> {
        validate_guardians(threshold, guardians)?;
        let mut fixed = [Pubkey::default(); MAX_GUARDIANS];
        for (i, key) in guardians.iter().enumerate() {
            fixed[i] = *key;
        }

        Ok(Self {
            version: STATE_VERSION,
            bump,
            threshold,
            guardian_count: guardians.len() as u8,
            guardian_set_version: 1,
            recovery_nonce: 0,
            config_seed: owner,
            owner,
            mint,
            pending_owner: Pubkey::default(),
            recovery_active: false,
            initiated_at: 0,
            executable_after: 0,
            expires_at: 0,
            frozen: false,
            guardians: fixed,
        })
    }

    pub fn pack(&self, dst: &mut [u8]) -> Result<(), ProgramError> {
        if dst.len() != STATE_LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        let mut o = 0usize;
        write_bytes(dst, &mut o, STATE_DISCRIMINATOR)?;
        write_u8(dst, &mut o, self.version)?;
        write_u8(dst, &mut o, self.bump)?;
        write_u8(dst, &mut o, self.threshold)?;
        write_u8(dst, &mut o, self.guardian_count)?;
        write_u64(dst, &mut o, self.guardian_set_version)?;
        write_u64(dst, &mut o, self.recovery_nonce)?;
        write_pubkey(dst, &mut o, &self.config_seed)?;
        write_pubkey(dst, &mut o, &self.owner)?;
        write_pubkey(dst, &mut o, &self.mint)?;
        write_pubkey(dst, &mut o, &self.pending_owner)?;
        write_bool(dst, &mut o, self.recovery_active)?;
        write_i64(dst, &mut o, self.initiated_at)?;
        write_i64(dst, &mut o, self.executable_after)?;
        write_i64(dst, &mut o, self.expires_at)?;
        write_bool(dst, &mut o, self.frozen)?;
        for key in &self.guardians {
            write_pubkey(dst, &mut o, key)?;
        }
        if o != STATE_LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(())
    }

    pub fn unpack(src: &[u8]) -> Result<Self, ProgramError> {
        if src.len() != STATE_LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        let mut o = 0usize;
        let discriminator = read_bytes::<8>(src, &mut o)?;
        if &discriminator != STATE_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let version = read_u8(src, &mut o)?;
        if version != STATE_VERSION {
            return Err(ProgramError::InvalidAccountData);
        }

        let bump = read_u8(src, &mut o)?;
        let threshold = read_u8(src, &mut o)?;
        let guardian_count = read_u8(src, &mut o)?;
        if guardian_count as usize > MAX_GUARDIANS {
            return Err(ProgramError::InvalidAccountData);
        }

        let guardian_set_version = read_u64(src, &mut o)?;
        let recovery_nonce = read_u64(src, &mut o)?;
        let config_seed = read_pubkey(src, &mut o)?;
        let owner = read_pubkey(src, &mut o)?;
        let mint = read_pubkey(src, &mut o)?;
        let pending_owner = read_pubkey(src, &mut o)?;
        let recovery_active = read_bool(src, &mut o)?;
        let initiated_at = read_i64(src, &mut o)?;
        let executable_after = read_i64(src, &mut o)?;
        let expires_at = read_i64(src, &mut o)?;
        let frozen = read_bool(src, &mut o)?;

        let mut guardians = [Pubkey::default(); MAX_GUARDIANS];
        for key in &mut guardians {
            *key = read_pubkey(src, &mut o)?;
        }

        let active = &guardians[..guardian_count as usize];
        validate_guardians(threshold, active)?;

        Ok(Self {
            version,
            bump,
            threshold,
            guardian_count,
            guardian_set_version,
            recovery_nonce,
            config_seed,
            owner,
            mint,
            pending_owner,
            recovery_active,
            initiated_at,
            executable_after,
            expires_at,
            frozen,
            guardians,
        })
    }
}

pub struct InitializeArgs {
    pub threshold: u8,
    pub guardians: Vec<Pubkey>,
}

pub fn parse_initialize(data: &[u8]) -> Result<InitializeArgs, ProgramError> {
    if data.len() < 3 || data[0] != 0 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let threshold = data[1];
    let count = data[2] as usize;
    if count == 0 || count > MAX_GUARDIANS {
        return Err(ProgramError::InvalidInstructionData);
    }
    let expected = 3usize
        .checked_add(count.checked_mul(32).ok_or(ProgramError::InvalidInstructionData)?)
        .ok_or(ProgramError::InvalidInstructionData)?;
    if data.len() != expected {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut guardians = Vec::with_capacity(count);
    for chunk in data[3..].chunks_exact(32) {
        guardians.push(Pubkey::new_from_array(
            chunk.try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
        ));
    }
    validate_guardians(threshold, &guardians)?;
    Ok(InitializeArgs { threshold, guardians })
}

pub fn validate_guardians(threshold: u8, guardians: &[Pubkey]) -> Result<(), ProgramError> {
    if guardians.is_empty() || guardians.len() > MAX_GUARDIANS {
        return Err(ProgramError::InvalidArgument);
    }
    if threshold < 2 || threshold as usize > guardians.len() {
        return Err(ProgramError::InvalidArgument);
    }
    for (i, key) in guardians.iter().enumerate() {
        if *key == Pubkey::default() {
            return Err(ProgramError::InvalidArgument);
        }
        if guardians[..i].contains(key) {
            return Err(ProgramError::InvalidArgument);
        }
    }
    Ok(())
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let args = parse_initialize(data)?;
    let mut iter = accounts.iter();

    let payer = next_account_info(&mut iter)?;
    let owner = next_account_info(&mut iter)?;
    let mint = next_account_info(&mut iter)?;
    let state_account = next_account_info(&mut iter)?;
    let system_program_account = next_account_info(&mut iter)?;

    if !payer.is_signer || !payer.is_writable {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !state_account.is_writable {
        return Err(ProgramError::InvalidAccountData);
    }
    if *system_program_account.key != system_program::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    if state_account.lamports() > 0 || state_account.data_len() > 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let (expected_state, bump) = Pubkey::find_program_address(
        &[CONFIG_SEED, owner.key.as_ref(), mint.key.as_ref()],
        program_id,
    );
    if expected_state != *state_account.key {
        return Err(ProgramError::InvalidSeeds);
    }

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(STATE_LEN);
    let ix = system_instruction::create_account(
        payer.key,
        state_account.key,
        lamports,
        STATE_LEN as u64,
        program_id,
    );

    let bump_bytes = [bump];
    let seeds: &[&[u8]] = &[
        CONFIG_SEED,
        owner.key.as_ref(),
        mint.key.as_ref(),
        &bump_bytes,
    ];
    invoke_signed(
        &ix,
        &[payer.clone(), state_account.clone(), system_program_account.clone()],
        &[seeds],
    )?;

    let state = GuardianState::new(
        bump,
        *owner.key,
        *mint.key,
        args.threshold,
        &args.guardians,
    )?;
    state.pack(&mut state_account.try_borrow_mut_data()?)?;

    solana_program::msg!(
        "SHAH Guardian G1 initialized: state-only, no custody or recovery execution"
    );
    Ok(())
}

fn write_bytes(dst: &mut [u8], o: &mut usize, bytes: &[u8]) -> Result<(), ProgramError> {
    let end = o.checked_add(bytes.len()).ok_or(ProgramError::InvalidAccountData)?;
    let target = dst.get_mut(*o..end).ok_or(ProgramError::InvalidAccountData)?;
    target.copy_from_slice(bytes);
    *o = end;
    Ok(())
}
fn write_u8(dst: &mut [u8], o: &mut usize, v: u8) -> Result<(), ProgramError> {
    write_bytes(dst, o, &[v])
}
fn write_bool(dst: &mut [u8], o: &mut usize, v: bool) -> Result<(), ProgramError> {
    write_u8(dst, o, u8::from(v))
}
fn write_u64(dst: &mut [u8], o: &mut usize, v: u64) -> Result<(), ProgramError> {
    write_bytes(dst, o, &v.to_le_bytes())
}
fn write_i64(dst: &mut [u8], o: &mut usize, v: i64) -> Result<(), ProgramError> {
    write_bytes(dst, o, &v.to_le_bytes())
}
fn write_pubkey(dst: &mut [u8], o: &mut usize, v: &Pubkey) -> Result<(), ProgramError> {
    write_bytes(dst, o, v.as_ref())
}

fn read_bytes<const N: usize>(src: &[u8], o: &mut usize) -> Result<[u8; N], ProgramError> {
    let end = o.checked_add(N).ok_or(ProgramError::InvalidAccountData)?;
    let bytes = src.get(*o..end).ok_or(ProgramError::InvalidAccountData)?;
    *o = end;
    bytes.try_into().map_err(|_| ProgramError::InvalidAccountData)
}
fn read_u8(src: &[u8], o: &mut usize) -> Result<u8, ProgramError> {
    Ok(read_bytes::<1>(src, o)?[0])
}
fn read_bool(src: &[u8], o: &mut usize) -> Result<bool, ProgramError> {
    match read_u8(src, o)? {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(ProgramError::InvalidAccountData),
    }
}
fn read_u64(src: &[u8], o: &mut usize) -> Result<u64, ProgramError> {
    Ok(u64::from_le_bytes(read_bytes::<8>(src, o)?))
}
fn read_i64(src: &[u8], o: &mut usize) -> Result<i64, ProgramError> {
    Ok(i64::from_le_bytes(read_bytes::<8>(src, o)?))
}
fn read_pubkey(src: &[u8], o: &mut usize) -> Result<Pubkey, ProgramError> {
    Ok(Pubkey::new_from_array(read_bytes::<32>(src, o)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys(n: usize) -> Vec<Pubkey> {
        (0..n).map(|_| Pubkey::new_unique()).collect()
    }

    #[test]
    fn state_round_trip() {
        let owner = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let guardians = keys(3);
        let state = GuardianState::new(254, owner, mint, 2, &guardians).unwrap();
        let mut bytes = vec![0u8; STATE_LEN];
        state.pack(&mut bytes).unwrap();
        let decoded = GuardianState::unpack(&bytes).unwrap();
        assert_eq!(state, decoded);
        assert_eq!(decoded.guardian_set_version, 1);
        assert_eq!(decoded.recovery_nonce, 0);
        assert_eq!(decoded.config_seed, owner);
        assert!(!decoded.recovery_active);
        assert!(!decoded.frozen);
    }

    #[test]
    fn rejects_duplicate_guardian() {
        let a = Pubkey::new_unique();
        assert!(validate_guardians(2, &[a, a]).is_err());
    }

    #[test]
    fn rejects_invalid_threshold() {
        let guardians = keys(2);
        assert!(validate_guardians(1, &guardians).is_err());
        assert!(validate_guardians(3, &guardians).is_err());
    }

    #[test]
    fn parses_initialize_instruction() {
        let guardians = keys(3);
        let mut data = vec![0, 2, 3];
        for key in &guardians {
            data.extend_from_slice(key.as_ref());
        }
        let parsed = parse_initialize(&data).unwrap();
        assert_eq!(parsed.threshold, 2);
        assert_eq!(parsed.guardians, guardians);
    }

    #[test]
    fn rejects_wrong_initialize_length() {
        let data = [0u8, 2, 2, 1, 2, 3];
        assert!(parse_initialize(&data).is_err());
    }

    #[test]
    fn state_length_constant_matches_layout() {
        let state = GuardianState::new(
            1,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            2,
            &keys(2),
        )
        .unwrap();
        let mut bytes = vec![0u8; STATE_LEN];
        state.pack(&mut bytes).unwrap();
        assert_eq!(bytes.len(), 342);
    }
}
