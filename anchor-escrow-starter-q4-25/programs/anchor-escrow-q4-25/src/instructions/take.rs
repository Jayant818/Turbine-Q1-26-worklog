#![allow(unused_imports)]

use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::Escrow;

#[derive(Accounts)]
pub struct Take<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_a,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_ata_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = taker,
        associated_token::token_program = token_program
    )]
    pub taker_ata_b: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub maker: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = maker,
        associated_token::mint = mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program
    )]
    pub maker_ata_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mint::token_program = token_program,
        address = escrow.mint_a,
    )]
    pub mint_a: InterfaceAccount<'info, Mint>,

    #[account(
        mint::token_program = token_program,
        address = escrow.mint_b,
    )]
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        close = maker,
        seeds = [b"escrow", maker.key().as_ref(), &escrow.seed.to_le_bytes()],
        bump = escrow.bump,
        has_one = maker,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account()]
    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,
}

impl<'info> Take<'info> {
    //      TODO: Implement Take Instruction
    //      Includes Deposit, Withdraw and Close Vault
    // we are depositting - transfer to the user and it need to atomic means take and get both
    pub fn deposit(&mut self) -> Result<()> {
        let escrow = &mut self.escrow;

        let transfer_accounts = TransferChecked {
            authority: self.taker.to_account_info(),
            from: self.taker_ata_b.to_account_info(),
            to: self.maker_ata_b.to_account_info(),
            mint: self.mint_b.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), transfer_accounts);

        transfer_checked(cpi_ctx, escrow.receive, self.mint_b.decimals)?;

        Ok(())
    }

    pub fn withdraw_and_close_vault(&mut self) -> Result<()> {
        // we also need to transfer from vault to the taker
        let transfer_accounts = TransferChecked {
            authority: self.escrow.to_account_info(),
            from: self.vault.to_account_info(),
            to: self.taker_ata_a.to_account_info(),
            mint: self.mint_a.to_account_info(),
        };

        // here we needs the seed and authority is escrow, so should we pass the seeds of the escrow or should have to seed of the vault program , but this doesn't have any seed clearly.
        let escrow_bump = self.escrow.bump;
        let seed_bytes = self.escrow.seed.to_le_bytes();
        let maker_key = self.maker.key();
        let signer_seeds: &[&[&[u8]]] =
            &[&[b"escrow", maker_key.as_ref(), &seed_bytes, &[escrow_bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            transfer_accounts,
            signer_seeds,
        );

        transfer_checked(cpi_ctx, self.vault.amount, self.mint_a.decimals)?;

        // Now we need to close the vault using CPI to the token program
        let close_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            authority: self.escrow.to_account_info(),
            destination: self.maker.to_account_info(),
        };

        let close_cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            close_accounts,
            signer_seeds,
        );

        close_account(close_cpi_ctx)
    }
}
