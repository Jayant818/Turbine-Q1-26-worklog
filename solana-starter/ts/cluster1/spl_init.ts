import { createMint } from '@solana/spl-token';
import { Commitment, Connection, Keypair } from "@solana/web3.js";
import wallet from "../turbin3-wallet.json";

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

(async () => {
    try {
      // Start here
      const mint = await createMint(
        connection,
        keypair,
        keypair.publicKey,
        keypair.publicKey,
        9,
      );

      // 9g2q3vjgiGdfVQFuke2a646qcgSgPPfYpmikTV5SgnFs
      console.log("Mint Details", mint);
    } catch(error) {
        console.log(`Oops, something went wrong: ${error}`)
    }
})()
