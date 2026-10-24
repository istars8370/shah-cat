//! C1 SBF integration scaffold. Deliberately rejects every authorization.
//! Do not deploy or fund: Falcon verification is NOT implemented.
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
};
#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

pub fn process_instruction(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Explicit versioned discriminator: [0x53,0x43,0x01] = SHAH C1 v1.
    // No success path is permitted until an on-chain Falcon verifier is independently validated.
    if data.len() < 3 || data[..3] != [0x53, 0x43, 0x01] {
        return Err(ProgramError::InvalidInstructionData);
    }
    Err(ProgramError::InvalidInstructionData)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_requests_fail_closed() {
        let id = Pubkey::new_unique();
        for data in [&[][..], &[0x53,0x43,0x01][..], &[0x53,0x43,0x01,1,2,3][..]] {
            assert!(process_instruction(&id, &[], data).is_err());
        }
    }
}
