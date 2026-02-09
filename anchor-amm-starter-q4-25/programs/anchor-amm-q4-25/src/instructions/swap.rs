use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};
use constant_product_curve::{ConstantProduct, LiquidityPair};

use crate::{errors::AmmError, state::Config};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub mint_x: Account<'info, Mint>,
    pub mint_y: Account<'info, Mint>,
    pub mint_lp: Account<'info, Mint>,
    #[account(
        mut,
        has_one = mint_x,
        has_one = mint_y,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = user,
    )]
    pub user_x_ata: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint_y,
        associated_token::authority = user,
    )]
    pub user_y_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_x,
        associated_token::authority = config,
    )]
    pub vault_x: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_y,
        associated_token::authority = config,
    )]
    pub vault_y: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint_lp,
        associated_token::authority = config,
    )]
    pub lp_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Swap<'info> {
    pub fn swap(&mut self, is_x: bool, amount: u64, min: u64) -> Result<()> {
        require!(self.config.locked == false, AmmError::PoolLocked);
        require!(amount > 0, AmmError::InvalidAmount);

        let user_token_balance = if is_x {
            self.user_x_ata.amount
        } else {
            self.user_y_ata.amount
        };
        require!(user_token_balance >= amount, AmmError::InsufficientBalance);

        let vault_meets_min = if is_x {
            self.vault_y.amount >= min
        } else {
            self.vault_x.amount >= min
        };
        require!(vault_meets_min, AmmError::LiquidityLessThanMinimum);

        let mut curve = ConstantProduct::init(
            self.vault_x.amount,
            self.vault_y.amount,
            self.lp_token_account.amount,
            self.config.fee,
            Some(self.mint_x.decimals),
        )
        .map_err(AmmError::from)?;

        let swap_pair = if is_x {
            LiquidityPair::X
        } else {
            LiquidityPair::Y
        };
        let swap_result = curve.swap(swap_pair, amount, min).map_err(AmmError::from)?;

        self.deposit_tokens(is_x, swap_result.deposit)?;
        self.withdraw_tokens(!is_x, swap_result.withdraw)?;

        Ok(())
    }

    pub fn deposit_tokens(&mut self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to) = if is_x {
            (&self.user_x_ata, &self.vault_x)
        } else {
            (&self.user_y_ata, &self.vault_y)
        };

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: self.user.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    fn withdraw_tokens(&self, is_x: bool, amount: u64) -> Result<()> {
        let (from, to) = if is_x {
            (&self.vault_x, &self.user_x_ata)
        } else {
            (&self.vault_y, &self.user_y_ata)
        };

        let config_seeds: &[&[&[u8]]] = &[&[
            b"config",
            &self.config.seed.to_le_bytes(),
            &[self.config.config_bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: self.config.to_account_info(),
                },
                config_seeds,
            ),
            amount,
        )?;

        Ok(())
    }
}
