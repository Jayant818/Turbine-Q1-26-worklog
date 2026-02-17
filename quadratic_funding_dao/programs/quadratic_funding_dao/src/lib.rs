pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::ErrorCode;
pub use instructions::*;
pub use state::*;

declare_id!("BdXqXRwJXwfNbJ8HNpqFKaBCs5pkMQDTPD9ywxN18Bes");

#[program]
pub mod quadratic_funding_dao {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn init_dao(ctx: Context<InitDao>, name: String) -> Result<()> {
        instructions::init_dao(ctx, name)
    }

    pub fn init_proposal(ctx: Context<InitProposalContext>, metadata: String) -> Result<()> {
        instructions::init_proposal(ctx, metadata)
    }

    pub fn cast_vote(ctx: Context<CastVoteContext>, vote_type: u8) -> Result<()> {
        instructions::cast_vote(ctx, vote_type)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
