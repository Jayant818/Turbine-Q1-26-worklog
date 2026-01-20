// Tx Id : 2u4i86g1tBxdRfSS8gHPk9CMtChnFhZuZhUH78nJ9dYdiALyUZLRCi2zAhkxiZuD6FodSCnYmrWEije66gVMySpW

import {
  createAssociatedTokenAccountIdempotent,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transferChecked,
} from "@solana/spl-token";
import { Commitment, Connection, Keypair, PublicKey } from "@solana/web3.js";
import wallet from "../turbin3-wallet.json";

// We're going to import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

// Mint address
const mint = new PublicKey("9g2q3vjgiGdfVQFuke2a646qcgSgPPfYpmikTV5SgnFs");

// Recipient address
const to = new PublicKey("EsBpCmULkvQrEgU6SjYkVdWUDR1avGAqjyHDyUbAbgix");

const TOKEN_DECIMAL = 1_000_000_000;

(async () => {
  try {
    // Get the token account of the fromWallet address, and if it does not exist, create it
    let fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      keypair.publicKey,
    );

    let fromAddress = fromTokenAccount.address;

    if (!fromTokenAccount.isInitialized) {
      fromAddress = await createAssociatedTokenAccountIdempotent(
        connection,
        keypair,
        mint,
        keypair.publicKey,
      );

      await mintTo(
        connection,
        keypair,
        mint,
        fromAddress,
        keypair,
        2 * TOKEN_DECIMAL,
      );
    }
    // Get the token account of the toWallet address, and if it does not exist, create it

    let toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      to,
    );

    // Transfer the new token to the "toTokenAccount" we just created

    const tx = await transferChecked(
      connection,
      keypair,
      fromAddress,
      mint,
      toTokenAccount.address,
      keypair,
      TOKEN_DECIMAL,
      9,
    );

    // 2u4i86g1tBxdRfSS8gHPk9CMtChnFhZuZhUH78nJ9dYdiALyUZLRCi2zAhkxiZuD6FodSCnYmrWEije66gVMySpW
    console.log("Tx ID: ", tx);
  } catch (e) {
    console.error(`Oops, something went wrong: ${e}`);
  }
})();
