use anchor_lang::prelude::*;

#[account]
#[derive(Debug, InitSpace)]
pub struct Vote {
    pub authority: Pubkey,
    pub vote_type: u8,
    pub voting_credits: u64,
    pub bump: u8,
}