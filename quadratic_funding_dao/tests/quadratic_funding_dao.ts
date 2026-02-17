import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { QuadraticFundingDao } from "../target/types/quadratic_funding_dao";
import {
  createMint,
  createAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

describe("quadratic_funding_dao", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .quadraticFundingDao as Program<QuadraticFundingDao>;
  const programId = program.programId;

  const daoName = "Test DAO";
  const proposalMetadata = "Proposal: fund project X";

  let creator: anchor.web3.Keypair;
  let daoPda: anchor.web3.PublicKey;
  let proposalPda: anchor.web3.PublicKey;
  let mint: anchor.web3.PublicKey;
  let voterTokenAccount: anchor.web3.PublicKey;

  before(async () => {
    creator = anchor.web3.Keypair.generate();

    const airdropSig = await provider.connection.requestAirdrop(
      creator.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    [daoPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("dao"),
        creator.publicKey.toBuffer(),
        Buffer.from(daoName, "utf-8"),
      ],
      programId
    );
  });

  it("initialize runs", async () => {
    const tx = await program.methods.initialize().rpc();
    expect(tx).to.be.a("string");
  });

  it("init_dao creates a DAO", async () => {
    await program.methods
      .initDao(daoName)
      .accountsPartial({
        creator: creator.publicKey,
        daoAccount: daoPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const dao = await program.account.dao.fetch(daoPda);
    expect(dao.name).to.equal(daoName);
    expect(dao.authority.equals(creator.publicKey)).to.be.true;
    expect(dao.proposalCount.toNumber()).to.equal(0);
  });

  it("init_proposal creates a proposal (DAO authority)", async () => {
    const dao = await program.account.dao.fetch(daoPda);
    const proposalCount = dao.proposalCount.toNumber();

    const proposalCountBuf = Buffer.alloc(8);
    proposalCountBuf.writeBigUint64LE(BigInt(proposalCount), 0);
    [proposalPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), daoPda.toBuffer(), proposalCountBuf],
      programId
    );

    await program.methods
      .initProposal(proposalMetadata)
      .accountsPartial({
        creator: creator.publicKey,
        daoAccount: daoPda,
        proposalAccount: proposalPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const proposal = await program.account.proposal.fetch(proposalPda);
    expect(proposal.metadata).to.equal(proposalMetadata);
    expect(proposal.authority.equals(creator.publicKey)).to.be.true;
    expect(proposal.yesVotes.toNumber()).to.equal(0);
    expect(proposal.noVotes.toNumber()).to.equal(0);

    const daoAfter = await program.account.dao.fetch(daoPda);
    expect(daoAfter.proposalCount.toNumber()).to.equal(1);
  });

  it("init_proposal fails when caller is not DAO authority", async () => {
    const notAuthority = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(
      notAuthority.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise((r) => setTimeout(r, 500));

    const dao = await program.account.dao.fetch(daoPda);
    const proposalCount = dao.proposalCount.toNumber();
    const proposalCountBuf = Buffer.alloc(8);
    proposalCountBuf.writeBigUint64LE(BigInt(proposalCount), 0);
    const [badProposalPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), daoPda.toBuffer(), proposalCountBuf],
      programId
    );

    try {
      await program.methods
        .initProposal("Unauthorized proposal")
        .accountsPartial({
          creator: notAuthority.publicKey,
          daoAccount: daoPda,
          proposalAccount: badProposalPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([notAuthority])
        .rpc();
      expect.fail("Expected NotDaoAuthority error");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).to.include("NotDaoAuthority");
    }
  });

  describe("cast_vote", () => {
    let voter: anchor.web3.Keypair;
    let votePda: anchor.web3.PublicKey;

    before(async () => {
      voter = anchor.web3.Keypair.generate();
      await provider.connection.requestAirdrop(
        voter.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((r) => setTimeout(r, 500));

      mint = await createMint(
        provider.connection,
        creator,
        creator.publicKey,
        null,
        6
      );

      voterTokenAccount = await createAccount(
        provider.connection,
        voter,
        mint,
        voter.publicKey
      );

      await mintTo(
        provider.connection,
        creator,
        mint,
        voterTokenAccount,
        creator,
        100 * 1e6
      );

      [votePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vote"), proposalPda.toBuffer(), voter.publicKey.toBuffer()],
        programId
      );
    });

    it("casts yes vote (vote_type = 1)", async () => {
      await program.methods
        .castVote(1)
        .accountsPartial({
          voter: voter.publicKey,
          proposalAccount: proposalPda,
          daoAccount: daoPda,
          voteAccount: votePda,
          voterTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      const vote = await program.account.vote.fetch(votePda);
      expect(vote.voteType).to.equal(1);
      expect(vote.authority.equals(voter.publicKey)).to.be.true;
      expect(vote.votingCredits.toNumber()).to.equal(10000);

      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.yesVotes.toNumber()).to.equal(10000);
      expect(proposal.noVotes.toNumber()).to.equal(0);
    });

    it("cast_vote fails with invalid vote_type", async () => {
      const voter2 = anchor.web3.Keypair.generate();
      await provider.connection.requestAirdrop(
        voter2.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await new Promise((r) => setTimeout(r, 500));

      const [vote2Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vote"), proposalPda.toBuffer(), voter2.publicKey.toBuffer()],
        programId
      );

      const voter2TokenAccount = await createAccount(
        provider.connection,
        voter2,
        mint,
        voter2.publicKey
      );
      await mintTo(
        provider.connection,
        creator,
        mint,
        voter2TokenAccount,
        creator,
        1e6
      );

      try {
        await program.methods
          .castVote(2)
          .accountsPartial({
            voter: voter2.publicKey,
            proposalAccount: proposalPda,
            daoAccount: daoPda,
            voteAccount: vote2Pda,
            voterTokenAccount: voter2TokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([voter2])
          .rpc();
        expect.fail("Expected InvalidVoteType error");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).to.include("InvalidVoteType");
      }
    });
  });
});
