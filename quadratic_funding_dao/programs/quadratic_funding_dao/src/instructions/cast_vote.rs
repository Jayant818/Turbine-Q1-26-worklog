use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::state::*;

#[derive(Accounts)]
pub struct CastVoteContext<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(mut)]
    pub proposal_account: Account<'info, Proposal>,

    pub dao_account: Account<'info, Dao>,

    #[account(
        init,
        payer = voter,
        space = 8 + Vote::INIT_SPACE,
        seeds = [b"vote", proposal_account.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub vote_account: Account<'info, Vote>,


    #[account(token::authority = voter)]
    pub voter_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn cast_vote(ctx: Context<CastVoteContext>, vote_type: u8) -> Result<()> {
    require!(vote_type <= 1, crate::ErrorCode::InvalidVoteType);

    let vote_account = &mut ctx.accounts.vote_account;
    let proposal_account = &mut ctx.accounts.proposal_account;
    let voting_credits: u64 = (ctx.accounts.voter_token_account.amount as f64).sqrt() as u64;

    vote_account.set_inner(Vote {
        authority: ctx.accounts.voter.key(),
        vote_type,
        voting_credits,
        bump: ctx.bumps.vote_account,
    });

    match vote_type {
        0 => proposal_account.no_votes = proposal_account.no_votes.saturating_add(voting_credits),
        _ => proposal_account.yes_votes = proposal_account.yes_votes.saturating_add(voting_credits),
    }

    Ok(())
}
