//! C3 experimental SBF verifier. Never authorizes custody or transfers.
//! Experimental Falcon verification is feature-gated and unaudited; do not deploy or fund.
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
};
#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Explicit versioned discriminator: [0x53,0x43,0x01] = SHAH C1 v1.
    // The default build rejects all requests. Experimental success never authorizes custody.
    if data.len() < 3 || data[..3] != [0x53, 0x43, 0x01] {
        return Err(ProgramError::InvalidInstructionData);
    }
    #[cfg(feature = "falcon-experimental")]
    {
        // C5 research: read a pre-provisioned, program-owned Falcon key account.
        // No key registration/update instruction exists yet. This path is not
        // a trust anchor until provisioning and governance are implemented.
        if data.len() >= 8 && data[3] == 2 {
            use solana_program::account_info::next_account_info;
            use tide_fn_dsa::{FalconProfile, VerifyingKey, VerifyingKeyStandard};
            let key_account = next_account_info(&mut accounts.iter())?;
            if key_account.owner != program_id || key_account.is_writable {
                return Err(ProgramError::InvalidAccountData);
            }
            let key_data = key_account.try_borrow_data()?;
            // Layout: "SCK1" | public-key-length u16 LE | public key bytes
            if key_data.len() < 6 || &key_data[..4] != b"SCK1" {
                return Err(ProgramError::InvalidAccountData);
            }
            let key_len = u16::from_le_bytes([key_data[4], key_data[5]]) as usize;
            if key_len == 0 || key_len > 1024 || key_data.len() != 6 + key_len {
                return Err(ProgramError::InvalidAccountData);
            }
            // Instruction: "SC" | 0x01 | 0x02 | sig-len u16 | msg-len u16 | sig | msg
            let sig_len = u16::from_le_bytes([data[4], data[5]]) as usize;
            let msg_len = u16::from_le_bytes([data[6], data[7]]) as usize;
            let expected = 8usize.checked_add(sig_len)
                .and_then(|n| n.checked_add(msg_len))
                .ok_or(ProgramError::InvalidInstructionData)?;
            if expected != data.len() || sig_len == 0 || sig_len > 1024
                || msg_len == 0 || msg_len > 256 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let verifier = VerifyingKeyStandard::decode(&key_data[6..])
                .ok_or(ProgramError::InvalidAccountData)?;
            let sig = &data[8..8+sig_len];
            let msg = &data[8+sig_len..];
            if !verifier.verify_falcon(FalconProfile::TidecoinLegacyFalcon512, sig, msg) {
                return Err(ProgramError::InvalidInstructionData);
            }
            solana_program::msg!("SHAH C5 research verified; NO token authority");
            return Ok(());
        }
        // C3 research instruction: "SC" + version 1 + 0x01 verify.
        // Input: header(4) | public-key-length(u16 LE) | signature-length(u16 LE)
        // | message-length(u16 LE) | public key | signature | message.
        // No on-chain state, no transfer authorization, no trusted key identity.
        if data.len() < 10 || data[3] != 1 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let pk_len = u16::from_le_bytes([data[4], data[5]]) as usize;
        let sig_len = u16::from_le_bytes([data[6], data[7]]) as usize;
        let msg_len = u16::from_le_bytes([data[8], data[9]]) as usize;
        let total = 10usize.checked_add(pk_len).and_then(|x|x.checked_add(sig_len))
            .and_then(|x|x.checked_add(msg_len))
            .ok_or(ProgramError::InvalidInstructionData)?;
        if total != data.len() || msg_len == 0 || msg_len > 256 || sig_len == 0 || sig_len > 1024 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let pk = &data[10..10+pk_len];
        let signature = &data[10+pk_len..10+pk_len+sig_len];
        let message = &data[10+pk_len+sig_len..];
        use tide_fn_dsa::{FalconProfile, VerifyingKey, VerifyingKeyStandard};
        let verifier = VerifyingKeyStandard::decode(pk)
            .ok_or(ProgramError::InvalidInstructionData)?;
        if !verifier.verify_falcon(FalconProfile::TidecoinLegacyFalcon512, signature, message) {
            return Err(ProgramError::InvalidInstructionData);
        }
        // Signature verification success only; NOT permission to move tokens.
        solana_program::msg!("SHAH C3 research signature verified; no custody authorization");
        return Ok(());
    }
    #[cfg(not(feature = "falcon-experimental"))]
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

    #[cfg(feature = "falcon-experimental")]
    #[test]
    fn malformed_c3_inputs_fail_closed() {
        let id = Pubkey::new_unique();
        let mut examples = vec![
            vec![0x53, 0x43, 0x01],
            vec![0x53, 0x43, 0x01, 0x01],
            vec![0x53, 0x43, 0x01, 0x02, 0, 0, 0, 0, 0, 0],
            vec![0x53, 0x43, 0x01, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
            vec![0x53, 0x43, 0x01, 0x01, 0, 0, 0, 0, 0, 0],
        ];
        // Declared one-byte message but missing message payload.
        examples.push(vec![0x53, 0x43, 0x01, 0x01, 0, 0, 0, 0, 1, 0]);
        // Empty public key, one-byte signature, one-byte message.
        examples.push(vec![0x53, 0x43, 0x01, 0x01, 0, 0, 1, 0, 1, 0, 0, 0]);
        for bytes in examples {
            assert!(process_instruction(&id, &[], &bytes).is_err());
        }
    }
}
