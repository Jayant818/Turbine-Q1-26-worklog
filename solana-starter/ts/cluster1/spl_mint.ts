import { createAssociatedTokenAccountIdempotent, mintToChecked } from "@solana/spl-token";
import { Commitment, Connection, Keypair, PublicKey } from "@solana/web3.js";
import wallet from "../turbin3-wallet.json";

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

const token_decimals = 1_000_000_000n;

// Mint address
const mint = new PublicKey("9g2q3vjgiGdfVQFuke2a646qcgSgPPfYpmikTV5SgnFs");

// ATA - BT4JpsBHZ1wS3yJSNisLWiecybCJgWZ8P2FwxwHXKuwt
(async () => {
  try {

    // Create an ATA
    const ata = await createAssociatedTokenAccountIdempotent(
      connection,
      keypair,
      mint,
      keypair.publicKey,
    );
    console.log("Your ata is: ", ata);

    // // Mint to ATA
    const mintTx = await mintToChecked(
      connection,
      keypair,
      mint,
      ata,
      keypair,
      2n * token_decimals,
      9,
    );

    console.log(`Your mint txid: ${mintTx}`);
  } catch (error) {
    console.log(`Oops, something went wrong: ${error}`);
  }
})();
