use anchor_lang::prelude::*;

use crate::state::*;

#[derive(Accounts)]
pub struct InitProposalContext<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        constraint = dao_account.authority == creator.key() @ crate::ErrorCode::NotDaoAuthority
    )]
    pub dao_account: Account<'info, Dao>,

    #[account(
        init,
        payer = creator,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", dao_account.key().as_ref(), dao_account.proposal_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub proposal_account: Account<'info, Proposal>,

    pub system_program: Program<'info, System>,
}

pub fn init_proposal(ctx: Context<InitProposalContext>, metadata: String) -> Result<()> {
    let proposal_account = &mut ctx.accounts.proposal_account;
    let dao_account = &mut ctx.accounts.dao_account;

    dao_account.proposal_count += 1;

    proposal_account.set_inner(Proposal {
        authority: ctx.accounts.creator.key(),
        metadata,
        yes_votes: 0,
        no_votes: 0,
        bump: ctx.bumps.proposal_account,
    });

    Ok(())
}
