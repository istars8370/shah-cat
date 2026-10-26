//! SHAH CAT Guardian G2 — authenticated recovery research program.
//!
//! Research scope only:
//! - persistent Guardian config PDA
//! - authenticated Guardian-signer recovery initiation
//! - owner-authenticated cancel and Guardian rotation
//! - permissionless finalize after trusted Clock delay
//! - durable nonce and Guardian-set version checks
//!
//! Explicitly out of scope:
//! - SPL token custody or token movement
//! - Treasury integration
//! - Falcon/PQC authorization
//! - Devnet deployment
//! - mainnet

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    program::invoke_signed,
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
pub const MIN_RECOVERY_DELAY_SECONDS: i64 = 3600;
pub const MAX_RECOVERY_WINDOW_SECONDS: i64 = 7 * 24 * 60 * 60;

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

    pub fn active_guardians(&self) -> &[Pubkey] {
        &self.guardians[..self.guardian_count as usize]
    }

    pub fn clear_pending(&mut self) {
        self.pending_owner = Pubkey::default();
        self.recovery_active = false;
        self.initiated_at = 0;
        self.executable_after = 0;
        self.expires_at = 0;
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

        validate_guardians(threshold, &guardians[..guardian_count as usize])?;

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

pub struct InitiateArgs {
    pub nonce: u64,
    pub guardian_set_version: u64,
    pub expiry_after_seconds: i64,
}

pub struct RotateArgs {
    pub threshold: u8,
    pub guardians: Vec<Pubkey>,
}

pub enum GuardianInstruction {
    Initialize(InitializeArgs),
    Initiate(InitiateArgs),
    Cancel,
    Finalize,
    Rotate(RotateArgs),
}

pub fn parse_instruction(data: &[u8]) -> Result<GuardianInstruction, ProgramError> {
    let opcode = *data.first().ok_or(ProgramError::InvalidInstructionData)?;
    match opcode {
        0 => Ok(GuardianInstruction::Initialize(parse_initialize(data)?)),
        1 => {
            if data.len() != 25 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let nonce = u64::from_le_bytes(
                data[1..9].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
            );
            let guardian_set_version = u64::from_le_bytes(
                data[9..17].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
            );
            let expiry_after_seconds = i64::from_le_bytes(
                data[17..25].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
            );
            Ok(GuardianInstruction::Initiate(InitiateArgs {
                nonce,
                guardian_set_version,
                expiry_after_seconds,
            }))
        }
        2 if data.len() == 1 => Ok(GuardianInstruction::Cancel),
        3 if data.len() == 1 => Ok(GuardianInstruction::Finalize),
        4 => Ok(GuardianInstruction::Rotate(parse_rotate(data)?)),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

pub fn parse_initialize(data: &[u8]) -> Result<InitializeArgs, ProgramError> {
    if data.len() < 3 || data[0] != 0 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let threshold = data[1];
    let count = data[2] as usize;
    let guardians = parse_guardian_list(data, 3, count)?;
    validate_guardians(threshold, &guardians)?;
    Ok(InitializeArgs { threshold, guardians })
}

pub fn parse_rotate(data: &[u8]) -> Result<RotateArgs, ProgramError> {
    if data.len() < 3 || data[0] != 4 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let threshold = data[1];
    let count = data[2] as usize;
    let guardians = parse_guardian_list(data, 3, count)?;
    validate_guardians(threshold, &guardians)?;
    Ok(RotateArgs { threshold, guardians })
}

fn parse_guardian_list(
    data: &[u8],
    offset: usize,
    count: usize,
) -> Result<Vec<Pubkey>, ProgramError> {
    if count == 0 || count > MAX_GUARDIANS {
        return Err(ProgramError::InvalidInstructionData);
    }
    let expected = offset
        .checked_add(count.checked_mul(32).ok_or(ProgramError::InvalidInstructionData)?)
        .ok_or(ProgramError::InvalidInstructionData)?;
    if data.len() != expected {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut guardians = Vec::with_capacity(count);
    for chunk in data[offset..].chunks_exact(32) {
        guardians.push(Pubkey::new_from_array(
            chunk.try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
        ));
    }
    Ok(guardians)
}

pub fn validate_guardians(threshold: u8, guardians: &[Pubkey]) -> Result<(), ProgramError> {
    if guardians.is_empty() || guardians.len() > MAX_GUARDIANS {
        return Err(ProgramError::InvalidArgument);
    }
    if threshold < 2 || threshold as usize > guardians.len() {
        return Err(ProgramError::InvalidArgument);
    }
    for (i, key) in guardians.iter().enumerate() {
        if *key == Pubkey::default() || guardians[..i].contains(key) {
            return Err(ProgramError::InvalidArgument);
        }
    }
    Ok(())
}

pub fn initiate_recovery_state(
    state: &mut GuardianState,
    proposed_owner: Pubkey,
    signer_guardians: &[Pubkey],
    nonce: u64,
    guardian_set_version: u64,
    now: i64,
    expiry_after_seconds: i64,
) -> Result<(), ProgramError> {
    if state.frozen || state.recovery_active {
        return Err(ProgramError::InvalidAccountData);
    }
    if proposed_owner == Pubkey::default() || proposed_owner == state.owner {
        return Err(ProgramError::InvalidArgument);
    }
    if guardian_set_version != state.guardian_set_version {
        return Err(ProgramError::InvalidArgument);
    }
    let expected_nonce = state
        .recovery_nonce
        .checked_add(1)
        .ok_or(ProgramError::InvalidArgument)?;
    if nonce != expected_nonce {
        return Err(ProgramError::InvalidArgument);
    }
    if expiry_after_seconds <= MIN_RECOVERY_DELAY_SECONDS
        || expiry_after_seconds > MAX_RECOVERY_WINDOW_SECONDS
    {
        return Err(ProgramError::InvalidArgument);
    }
    validate_guardian_quorum(state, signer_guardians)?;

    let executable_after = now
        .checked_add(MIN_RECOVERY_DELAY_SECONDS)
        .ok_or(ProgramError::InvalidArgument)?;
    let expires_at = now
        .checked_add(expiry_after_seconds)
        .ok_or(ProgramError::InvalidArgument)?;

    state.recovery_nonce = nonce;
    state.pending_owner = proposed_owner;
    state.recovery_active = true;
    state.initiated_at = now;
    state.executable_after = executable_after;
    state.expires_at = expires_at;
    Ok(())
}

pub fn cancel_recovery_state(
    state: &mut GuardianState,
    caller: Pubkey,
) -> Result<(), ProgramError> {
    if caller != state.owner || !state.recovery_active {
        return Err(ProgramError::InvalidArgument);
    }
    state.clear_pending();
    Ok(())
}

pub fn finalize_recovery_state(
    state: &mut GuardianState,
    now: i64,
) -> Result<(), ProgramError> {
    if state.frozen || !state.recovery_active || state.pending_owner == Pubkey::default() {
        return Err(ProgramError::InvalidAccountData);
    }
    if now < state.executable_after || now >= state.expires_at {
        return Err(ProgramError::InvalidArgument);
    }
    state.owner = state.pending_owner;
    state.clear_pending();
    Ok(())
}

pub fn rotate_guardians_state(
    state: &mut GuardianState,
    caller: Pubkey,
    threshold: u8,
    guardians: &[Pubkey],
) -> Result<(), ProgramError> {
    if caller != state.owner || state.recovery_active {
        return Err(ProgramError::InvalidArgument);
    }
    validate_guardians(threshold, guardians)?;
    let next_version = state
        .guardian_set_version
        .checked_add(1)
        .ok_or(ProgramError::InvalidArgument)?;

    state.guardians = [Pubkey::default(); MAX_GUARDIANS];
    for (i, key) in guardians.iter().enumerate() {
        state.guardians[i] = *key;
    }
    state.guardian_count = guardians.len() as u8;
    state.threshold = threshold;
    state.guardian_set_version = next_version;
    Ok(())
}

fn validate_guardian_quorum(
    state: &GuardianState,
    signer_guardians: &[Pubkey],
) -> Result<(), ProgramError> {
    if signer_guardians.len() < state.threshold as usize {
        return Err(ProgramError::MissingRequiredSignature);
    }
    for (i, signer) in signer_guardians.iter().enumerate() {
        if signer_guardians[..i].contains(signer) || !state.active_guardians().contains(signer) {
            return Err(ProgramError::MissingRequiredSignature);
        }
    }
    Ok(())
}

fn validate_state_account(
    program_id: &Pubkey,
    state_account: &AccountInfo,
    state: &GuardianState,
) -> Result<(), ProgramError> {
    if state_account.owner != program_id || !state_account.is_writable {
        return Err(ProgramError::IncorrectProgramId);
    }
    let (expected, bump) = Pubkey::find_program_address(
        &[CONFIG_SEED, state.config_seed.as_ref(), state.mint.as_ref()],
        program_id,
    );
    if expected != *state_account.key || bump != state.bump {
        return Err(ProgramError::InvalidSeeds);
    }
    Ok(())
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    match parse_instruction(data)? {
        GuardianInstruction::Initialize(args) => process_initialize(program_id, accounts, args),
        GuardianInstruction::Initiate(args) => process_initiate(program_id, accounts, args),
        GuardianInstruction::Cancel => process_cancel(program_id, accounts),
        GuardianInstruction::Finalize => process_finalize(program_id, accounts),
        GuardianInstruction::Rotate(args) => process_rotate(program_id, accounts, args),
    }
}

fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: InitializeArgs,
) -> ProgramResult {
    let mut iter = accounts.iter();
    let payer = next_account_info(&mut iter)?;
    let owner = next_account_info(&mut iter)?;
    let mint = next_account_info(&mut iter)?;
    let state_account = next_account_info(&mut iter)?;
    let system_program_account = next_account_info(&mut iter)?;

    if !payer.is_signer || !payer.is_writable || !owner.is_signer {
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
    Ok(())
}

fn process_initiate(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: InitiateArgs,
) -> ProgramResult {
    let mut iter = accounts.iter();
    let state_account = next_account_info(&mut iter)?;
    let proposed_owner = next_account_info(&mut iter)?;
    let mut state = GuardianState::unpack(&state_account.try_borrow_data()?)?;
    validate_state_account(program_id, state_account, &state)?;

    let mut signer_keys = Vec::new();
    for account in iter {
        if !account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        signer_keys.push(*account.key);
    }

    let now = Clock::get()?.unix_timestamp;
    initiate_recovery_state(
        &mut state,
        *proposed_owner.key,
        &signer_keys,
        args.nonce,
        args.guardian_set_version,
        now,
        args.expiry_after_seconds,
    )?;
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    Ok(())
}

fn process_cancel(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let mut iter = accounts.iter();
    let state_account = next_account_info(&mut iter)?;
    let owner = next_account_info(&mut iter)?;
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut state = GuardianState::unpack(&state_account.try_borrow_data()?)?;
    validate_state_account(program_id, state_account, &state)?;
    cancel_recovery_state(&mut state, *owner.key)?;
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    Ok(())
}

fn process_finalize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let mut iter = accounts.iter();
    let state_account = next_account_info(&mut iter)?;
    let mut state = GuardianState::unpack(&state_account.try_borrow_data()?)?;
    validate_state_account(program_id, state_account, &state)?;

    let now = Clock::get()?.unix_timestamp;
    finalize_recovery_state(&mut state, now)?;
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    Ok(())
}

fn process_rotate(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: RotateArgs,
) -> ProgramResult {
    let mut iter = accounts.iter();
    let state_account = next_account_info(&mut iter)?;
    let owner = next_account_info(&mut iter)?;
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut state = GuardianState::unpack(&state_account.try_borrow_data()?)?;
    validate_state_account(program_id, state_account, &state)?;
    rotate_guardians_state(&mut state, *owner.key, args.threshold, &args.guardians)?;
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
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

    fn base_state() -> GuardianState {
        GuardianState::new(
            254,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            2,
            &keys(3),
        )
        .unwrap()
    }

    #[test]
    fn state_round_trip_v2() {
        let state = base_state();
        let mut bytes = vec![0u8; STATE_LEN];
        state.pack(&mut bytes).unwrap();
        let decoded = GuardianState::unpack(&bytes).unwrap();
        assert_eq!(state, decoded);
        assert_eq!(decoded.config_seed, state.owner);
        assert_eq!(bytes.len(), 342);
    }

    #[test]
    fn initiate_requires_quorum_and_consumes_nonce() {
        let mut state = base_state();
        let guardians = state.active_guardians().to_vec();
        let new_owner = Pubkey::new_unique();
        initiate_recovery_state(
            &mut state,
            new_owner,
            &guardians[..2],
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        assert!(state.recovery_active);
        assert_eq!(state.pending_owner, new_owner);
        assert_eq!(state.recovery_nonce, 1);
        assert_eq!(state.executable_after, 4600);
        assert_eq!(state.expires_at, 8200);
    }

    #[test]
    fn initiate_rejects_duplicate_or_outsider_guardians() {
        let mut state = base_state();
        let g = state.active_guardians()[0];
        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &[g, g],
            1,
            1,
            1000,
            7200
        )
        .is_err());

        let mut state = base_state();
        let first = state.active_guardians()[0];
        let outsider = Pubkey::new_unique();
        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &[first, outsider],
            1,
            1,
            1000,
            7200
        )
        .is_err());
    }

    #[test]
    fn initiate_rejects_stale_nonce_version_and_bad_expiry() {
        let mut state = base_state();
        let signers = state.active_guardians()[..2].to_vec();
        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            2,
            1,
            1000,
            7200
        )
        .is_err());
        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            2,
            1000,
            7200
        )
        .is_err());
        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            MIN_RECOVERY_DELAY_SECONDS
        )
        .is_err());
    }

    #[test]
    fn cancel_requires_current_owner_and_keeps_nonce_consumed() {
        let mut state = base_state();
        let signers = state.active_guardians()[..2].to_vec();
        initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        let owner = state.owner;
        assert!(cancel_recovery_state(&mut state, Pubkey::new_unique()).is_err());
        cancel_recovery_state(&mut state, owner).unwrap();
        assert!(!state.recovery_active);
        assert_eq!(state.recovery_nonce, 1);
    }

    #[test]
    fn finalize_respects_delay_and_expiry_and_preserves_config_seed() {
        let mut state = base_state();
        let config_seed = state.config_seed;
        let new_owner = Pubkey::new_unique();
        let signers = state.active_guardians()[..2].to_vec();
        initiate_recovery_state(
            &mut state,
            new_owner,
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        assert!(finalize_recovery_state(&mut state, 4599).is_err());
        finalize_recovery_state(&mut state, 4600).unwrap();
        assert_eq!(state.owner, new_owner);
        assert_eq!(state.config_seed, config_seed);
        assert!(!state.recovery_active);
    }

    #[test]
    fn finalize_rejects_expired_or_frozen() {
        let mut expired = base_state();
        let signers = expired.active_guardians()[..2].to_vec();
        initiate_recovery_state(
            &mut expired,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        assert!(finalize_recovery_state(&mut expired, 8200).is_err());

        let mut frozen = base_state();
        let signers = frozen.active_guardians()[..2].to_vec();
        initiate_recovery_state(
            &mut frozen,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        frozen.frozen = true;
        assert!(finalize_recovery_state(&mut frozen, 4600).is_err());
    }

    #[test]
    fn rotate_requires_owner_and_no_active_recovery() {
        let mut state = base_state();
        let owner = state.owner;
        let next = keys(3);
        assert!(rotate_guardians_state(&mut state, Pubkey::new_unique(), 2, &next).is_err());
        rotate_guardians_state(&mut state, owner, 2, &next).unwrap();
        assert_eq!(state.guardian_set_version, 2);
        assert_eq!(state.active_guardians(), next.as_slice());

        let signers = state.active_guardians()[..2].to_vec();
        initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            2,
            1000,
            7200,
        )
        .unwrap();
        assert!(rotate_guardians_state(&mut state, owner, 2, &keys(2)).is_err());
    }

    #[test]
    fn parses_g2_instructions() {
        let mut initiate = vec![1];
        initiate.extend_from_slice(&1u64.to_le_bytes());
        initiate.extend_from_slice(&1u64.to_le_bytes());
        initiate.extend_from_slice(&7200i64.to_le_bytes());
        assert!(matches!(
            parse_instruction(&initiate).unwrap(),
            GuardianInstruction::Initiate(_)
        ));
        assert!(matches!(
            parse_instruction(&[2]).unwrap(),
            GuardianInstruction::Cancel
        ));
        assert!(matches!(
            parse_instruction(&[3]).unwrap(),
            GuardianInstruction::Finalize
        ));
    }

    #[test]
    fn cancelled_recovery_nonce_cannot_be_reused() {
        let mut state = base_state();
        let owner = state.owner;
        let signers = state.active_guardians()[..2].to_vec();

        initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        cancel_recovery_state(&mut state, owner).unwrap();

        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            2000,
            7200,
        )
        .is_err());

        initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            2,
            1,
            2000,
            7200,
        )
        .unwrap();
        assert_eq!(state.recovery_nonce, 2);
    }

    #[test]
    fn finalized_recovery_nonce_cannot_be_reused() {
        let mut state = base_state();
        let old_signers = state.active_guardians()[..2].to_vec();

        initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &old_signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        finalize_recovery_state(&mut state, 4600).unwrap();

        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &old_signers,
            1,
            1,
            5000,
            7200,
        )
        .is_err());
    }

    #[test]
    fn finalize_time_boundaries_are_fail_closed() {
        let mut early = base_state();
        let signers = early.active_guardians()[..2].to_vec();
        initiate_recovery_state(
            &mut early,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        let just_before = early.executable_after - 1;
        assert!(finalize_recovery_state(&mut early, just_before).is_err());

        let mut exact = base_state();
        let signers = exact.active_guardians()[..2].to_vec();
        initiate_recovery_state(
            &mut exact,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        let executable = exact.executable_after;
        assert!(finalize_recovery_state(&mut exact, executable).is_ok());

        let mut expired = base_state();
        let signers = expired.active_guardians()[..2].to_vec();
        initiate_recovery_state(
            &mut expired,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .unwrap();
        let expiry = expired.expires_at;
        assert!(finalize_recovery_state(&mut expired, expiry).is_err());
    }

    #[test]
    fn stale_guardian_set_version_rejected_after_rotation() {
        let mut state = base_state();
        let owner = state.owner;
        let next_guardians = keys(3);
        rotate_guardians_state(&mut state, owner, 2, &next_guardians).unwrap();

        assert_eq!(state.guardian_set_version, 2);
        let signers = state.active_guardians()[..2].to_vec();

        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            7200,
        )
        .is_err());

        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            2,
            1000,
            7200,
        )
        .is_ok());
    }

    #[test]
    fn expiry_window_upper_bound_is_enforced() {
        let mut state = base_state();
        let signers = state.active_guardians()[..2].to_vec();

        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            MAX_RECOVERY_WINDOW_SECONDS + 1,
        )
        .is_err());

        assert!(initiate_recovery_state(
            &mut state,
            Pubkey::new_unique(),
            &signers,
            1,
            1,
            1000,
            MAX_RECOVERY_WINDOW_SECONDS,
        )
        .is_ok());
    }

}
