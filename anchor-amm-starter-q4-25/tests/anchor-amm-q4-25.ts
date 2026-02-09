import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import {
  createMint,
  createAssociatedTokenAccount,
  createAssociatedTokenAccountIdempotent,
  mintTo,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { expect } from "chai";

const TOKEN_DECIMALS = 6;
const FEE_BPS = 30; // 0.3%
const SEED = 12345;

const toTokenAmount = (amount: number) => amount * 10 ** TOKEN_DECIMALS;
const getBalance = async (connection: any, account: PublicKey) => {
  const bal = await connection.getTokenAccountBalance(account);
  return Number(bal.value.amount);
};

describe("anchor-amm-q4-25", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorAmmQ425 as Program<AnchorAmmQ425>;
  const programId = program.programId;

  let mintX: PublicKey;
  let mintY: PublicKey;
  let userXAta: PublicKey;
  let userYAta: PublicKey;
  let configPda: PublicKey;
  let mintLpPda: PublicKey;
  let vaultXPda: PublicKey;
  let vaultYPda: PublicKey;

  const user = provider.wallet as anchor.Wallet;

  before(async () => {
    const connection = provider.connection;

    mintX = await createMint(
      connection,
      user.payer,
      user.publicKey,
      null,
      TOKEN_DECIMALS
    );

    mintY = await createMint(
      connection,
      user.payer,
      user.publicKey,
      null,
      TOKEN_DECIMALS
    );

    userXAta = await createAssociatedTokenAccount(
      connection,
      user.payer,
      mintX,
      user.publicKey
    );

    userYAta = await createAssociatedTokenAccount(
      connection,
      user.payer,
      mintY,
      user.publicKey
    );

    const initAmount = toTokenAmount(1_500_000);
    await mintTo(connection, user.payer, mintX, userXAta, user.publicKey, initAmount);
    await mintTo(connection, user.payer, mintY, userYAta, user.publicKey, initAmount);

    const [config] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), Buffer.from(new anchor.BN(SEED).toArrayLike(Buffer, "le", 8))],
      programId
    );
    configPda = config;

    [mintLpPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), configPda.toBuffer()],
      programId
    );

    vaultXPda = getAssociatedTokenAddressSync(mintX, configPda, true);
    vaultYPda = getAssociatedTokenAddressSync(mintY, configPda, true);
  });

  it("initializes the AMM pool", async () => {
    await program.methods
      .initialize(new anchor.BN(SEED), FEE_BPS, null)
      .accounts({
        initializer: user.publicKey,
        mintX,
        mintY,
        mintLp: mintLpPda,
        vaultX: vaultXPda,
        vaultY: vaultYPda,
        config: configPda,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const configAccount = await program.account.config.fetch(configPda);
    expect(configAccount.seed.toNumber()).to.equal(SEED);
    expect(configAccount.fee).to.equal(FEE_BPS);
    expect(configAccount.mintX.toString()).to.equal(mintX.toString());
    expect(configAccount.mintY.toString()).to.equal(mintY.toString());
    expect(configAccount.locked).to.be.false;

    await createAssociatedTokenAccountIdempotent(
      provider.connection,
      user.payer,
      mintLpPda,
      configPda,
      undefined,
      undefined,
      undefined,
      true
    );
  });

  it("deposits liquidity into pool", async () => {
    const depositX = toTokenAmount(150_000);
    const depositY = toTokenAmount(150_000);
    const lpAmount = toTokenAmount(150_000);

    const userLpAta = getAssociatedTokenAddressSync(mintLpPda, user.publicKey);

    await program.methods
      .deposit(
        new anchor.BN(lpAmount),
        new anchor.BN(depositX),
        new anchor.BN(depositY)
      )
      .accounts({
        user: user.publicKey,
        mintX,
        mintY,
        config: configPda,
        mintLp: mintLpPda,
        vaultX: vaultXPda,
        vaultY: vaultYPda,
        userX: userXAta,
        userY: userYAta,
        userLp: userLpAta,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    const userLpBalance = await getBalance(provider.connection, userLpAta);
    expect(userLpBalance).to.equal(lpAmount);
  });

  it("swaps X tokens for Y tokens", async () => {
    const amountIn = toTokenAmount(15_000);
    const minAmountOut = 0;

    const lpTokenAccount = getAssociatedTokenAddressSync(mintLpPda, configPda, true);

    const userYBefore = await getBalance(provider.connection, userYAta);

    await program.methods
      .swap(true, new anchor.BN(amountIn), new anchor.BN(minAmountOut))
      .accounts({
        user: user.publicKey,
        mintX,
        mintY,
        mintLp: mintLpPda,
        config: configPda,
        userXAta: userXAta,
        userYAta: userYAta,
        vaultX: vaultXPda,
        vaultY: vaultYPda,
        lpTokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    const userYAfter = await getBalance(provider.connection, userYAta);
    expect(userYAfter).to.be.greaterThan(userYBefore);
  });

  it("swaps Y tokens for X tokens", async () => {
    const amountIn = toTokenAmount(8_000);
    const minAmountOut = 0;

    const lpTokenAccount = getAssociatedTokenAddressSync(mintLpPda, configPda, true);

    const userXBefore = await getBalance(provider.connection, userXAta);

    await program.methods
      .swap(false, new anchor.BN(amountIn), new anchor.BN(minAmountOut))
      .accounts({
        user: user.publicKey,
        mintX,
        mintY,
        mintLp: mintLpPda,
        config: configPda,
        userXAta: userXAta,
        userYAta: userYAta,
        vaultX: vaultXPda,
        vaultY: vaultYPda,
        lpTokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    const userXAfter = await getBalance(provider.connection, userXAta);
    expect(userXAfter).to.be.greaterThan(userXBefore);
  });

  it("withdraws liquidity", async () => {
    const userLpAta = getAssociatedTokenAddressSync(mintLpPda, user.publicKey);
    const userLpBalance = await provider.connection.getTokenAccountBalance(userLpAta);
    const withdrawAmount = Number(userLpBalance.value.amount) / 2;

    const userXBefore = await provider.connection.getTokenAccountBalance(userXAta);
    const userYBefore = await provider.connection.getTokenAccountBalance(userYAta);

    await program.methods
      .withdraw(
        new anchor.BN(withdrawAmount),
        new anchor.BN(0),
        new anchor.BN(0)
      )
      .accounts({
        user: user.publicKey,
        mintX,
        mintY,
        config: configPda,
        mintLp: mintLpPda,
        vaultX: vaultXPda,
        vaultY: vaultYPda,
        userX: userXAta,
        userY: userYAta,
        userLp: userLpAta,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();

    const userXAfter = await provider.connection.getTokenAccountBalance(userXAta);
    const userYAfter = await provider.connection.getTokenAccountBalance(userYAta);

    expect(Number(userXAfter.value.amount)).to.be.greaterThan(Number(userXBefore.value.amount));
    expect(Number(userYAfter.value.amount)).to.be.greaterThan(Number(userYBefore.value.amount));
  });

  it("rejects deposit with zero amount", async () => {
    const userLpAta = getAssociatedTokenAddressSync(mintLpPda, user.publicKey);

    try {
      await program.methods
        .deposit(new anchor.BN(0), new anchor.BN(1000), new anchor.BN(1000))
        .accounts({
          user: user.publicKey,
          mintX,
          mintY,
          config: configPda,
          mintLp: mintLpPda,
          vaultX: vaultXPda,
          vaultY: vaultYPda,
          userX: userXAta,
          userY: userYAta,
          userLp: userLpAta,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .rpc();

      expect.fail("Should have thrown");
    } catch (err: unknown) {
      const anchorErr = err as { error?: { errorCode?: { code?: string; number?: number } } };
      const { code, number } = anchorErr.error?.errorCode ?? {};
      expect(number === 6014 || code === "InvalidAmount" || code === "invalidAmount").to.be.true;
    }
  });

  it("rejects swap with zero amount", async () => {
    const lpTokenAccount = getAssociatedTokenAddressSync(mintLpPda, configPda, true);

    try {
      await program.methods
        .swap(true, new anchor.BN(0), new anchor.BN(0))
        .accounts({
          user: user.publicKey,
          mintX,
          mintY,
          mintLp: mintLpPda,
          config: configPda,
          userXAta: userXAta,
          userYAta: userYAta,
          vaultX: vaultXPda,
          vaultY: vaultYPda,
          lpTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .rpc();

      expect.fail("Should have thrown");
    } catch (err: unknown) {
      const anchorErr = err as { error?: { errorCode?: { code?: string; number?: number } } };
      const { code, number } = anchorErr.error?.errorCode ?? {};
      expect(number === 6014 || code === "InvalidAmount" || code === "invalidAmount").to.be.true;
    }
  });
});