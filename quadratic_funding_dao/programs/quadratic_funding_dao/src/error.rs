use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Vote type must be 0 (no) or 1 (yes)")]
    InvalidVoteType,
    #[msg("Only the DAO authority can create proposals")]
    NotDaoAuthority,
}