import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorDiceGameQ425 } from "../target/types/anchor_dice_game_q4_25";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Ed25519Program } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { expect } from "chai";

function u128ToLeBytes(n: bigint): Buffer {
  const buf = Buffer.alloc(16);
  const lo = n & BigInt("0xFFFFFFFFFFFFFFFF");
  const hi = n >> BigInt(64);
  buf.writeBigUInt64LE(lo, 0);
  buf.writeBigUInt64LE(hi, 8);
  return buf;
}

function betToSlice(bet: {
  player: PublicKey;
  seed: anchor.BN;
  slot: anchor.BN;
  amount: anchor.BN;
  roll: number;
  bump: number;
}): Buffer {
  const buf = Buffer.alloc(66);
  bet.player.toBuffer().copy(buf, 0);
  u128ToLeBytes(BigInt(bet.seed.toString())).copy(buf, 32);
  buf.writeBigUInt64LE(BigInt(bet.slot.toString()), 48);
  buf.writeBigUInt64LE(BigInt(bet.amount.toString()), 56);
  buf[64] = bet.roll;
  buf[65] = bet.bump;
  return buf;
}

describe("anchor-dice-game-q4-25", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .AnchorDiceGameQ425 as Program<AnchorDiceGameQ425>;

  const house = provider.wallet.publicKey;
  const houseKeypair = (provider.wallet as anchor.Wallet).payer;
  const playerKeypair = Keypair.generate();
  const player = playerKeypair.publicKey;

  const INIT_AMOUNT = 10 * anchor.web3.LAMPORTS_PER_SOL;
  const BET_AMOUNT = anchor.web3.LAMPORTS_PER_SOL;
  const BET_SEED = new anchor.BN("12345678901234567890");
  const BET_ROLL = 50;

  let vaultPda: PublicKey;

  before(async () => {
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), house.toBuffer()],
      program.programId
    );

    const airdropSig = await provider.connection.requestAirdrop(
      player,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);
  });

  it("initializes the vault", async () => {
    await program.methods
      .initialize(new anchor.BN(INIT_AMOUNT))
      .accounts({
        house,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vaultInfo = await provider.connection.getAccountInfo(vaultPda);
    expect(vaultInfo).to.not.be.null;
    expect(vaultInfo!.lamports).to.equal(INIT_AMOUNT);
  });

  it("places a bet", async () => {
    const [betPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), vaultPda.toBuffer(), u128ToLeBytes(BigInt(BET_SEED.toString()))],
      program.programId
    );

    await program.methods
      .placeBet(BET_SEED, BET_ROLL, new anchor.BN(BET_AMOUNT))
      .accounts({
        player,
        house,
        vault: vaultPda,
        bet: betPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([playerKeypair])
      .rpc();

    const betAccount = await program.account.bet.fetch(betPda);
    expect(betAccount.player.toBase58()).to.equal(player.toBase58());
    expect(betAccount.amount.toNumber()).to.equal(BET_AMOUNT);
    expect(betAccount.roll).to.equal(BET_ROLL);
  });

  it("refund fails when timeout not reached", async () => {
    const [betPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), vaultPda.toBuffer(), u128ToLeBytes(BigInt(BET_SEED.toString()))],
      program.programId
    );

    try {
      await program.methods
        .refundBet()
        .accounts({
          player,
          house,
          vault: vaultPda,
          bet: betPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerKeypair])
        .rpc();
      expect.fail("Should have thrown TimeoutNotReached");
    } catch (err: any) {
      expect(err.message).to.include("TimeoutNotReached");
    }
  });

  it("resolves a bet with valid Ed25519 signature", async () => {
    const [betPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), vaultPda.toBuffer(), u128ToLeBytes(BigInt(BET_SEED.toString()))],
      program.programId
    );

    const betAccount = await program.account.bet.fetch(betPda);
    const message = betToSlice(betAccount);

    const sigBytes = ed25519.sign(message, houseKeypair.secretKey.slice(0, 32));

    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: houseKeypair.publicKey.toBytes(),
      message,
      signature: sigBytes,
    });

    await program.methods
      .resolveBet(Buffer.from(sigBytes))
      .accounts({
        house,
        player,
        vault: vaultPda,
        bet: betPda,
        instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ed25519Ix])
      .rpc();
  });
});