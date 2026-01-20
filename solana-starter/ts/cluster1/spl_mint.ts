// Your ata is:  PublicKey [PublicKey(BT4JpsBHZ1wS3yJSNisLWiecybCJgWZ8P2FwxwHXKuwt)] {
//   _bn: <BN: 9b41b5bcc7529509be926bcac6cb373bdc94f6eaa75287535241ae463125896f>
// }
// Your mint txid: 2nLfEFjjL9FsFRR2eZV8nEw3eb38AJvNF3kMKZ1VBTwg5H6i6pEWm9pshevfQtFez5jdJh1bmkyykzh8CtSJ1hRD

import {
  createAssociatedTokenAccountIdempotent,
  mintToChecked,
} from "@solana/spl-token";
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
