// eKm61W2vpvM6MyjMNamuBi2Z25B9xQL8g8YH8ytHAaFXZVdGf31kmj42PeG7uRdrYUhhgUVzwLDvX4GePFmf7tn

import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  createMetadataAccountV3,
  CreateMetadataAccountV3InstructionAccounts,
  CreateMetadataAccountV3InstructionArgs,
  DataV2Args,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import wallet from "../turbin3-wallet.json";

// Define our Mint address
const mint = publicKey("9g2q3vjgiGdfVQFuke2a646qcgSgPPfYpmikTV5SgnFs");

// Create a UMI connection
const umi = createUmi("https://api.devnet.solana.com");
const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(createSignerFromKeypair(umi, keypair)));

(async () => {
  try {
    // Start here
    let accounts: CreateMetadataAccountV3InstructionAccounts = {
      mint: mint,
      mintAuthority: signer,
    };
    let data: DataV2Args = {
      name: "Jayant Token",
      symbol: "JAY",
      uri: "https://example.com/jayant-token-metadata.json",
      sellerFeeBasisPoints: 500, // 5%
      creators: null,
      collection: null,
      uses: null,
    };

    let args: CreateMetadataAccountV3InstructionArgs = {
      data,
      isMutable: true,
      collectionDetails: null,
    };

    let tx = createMetadataAccountV3(umi, {
      ...accounts,
      ...args,
    });

    let result = await tx.sendAndConfirm(umi);
    console.log(bs58.encode(result.signature));
  } catch (e) {
    console.error(`Oops, something went wrong: ${e}`);
  }
})();
