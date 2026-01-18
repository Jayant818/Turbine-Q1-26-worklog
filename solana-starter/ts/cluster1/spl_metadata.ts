import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import wallet from "../turbin3-wallet.json";

// Define our Mint address
const mint = publicKey("9dzAC6VSngUn4ZnxXvNk5GCk5C9TbqH4KXDxWr9L7pvJ");

// Create a UMI connection
const umi = createUmi("https://api.devnet.solana.com");
const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(createSignerFromKeypair(umi, keypair)));

(async () => {
  try {
    // Start here
    // let accounts: CreateMetadataAccountV3InstructionAccounts = {
    //     ???
    // }
    // let data: DataV2Args = {
    //     ???
    // }
    // let args: CreateMetadataAccountV3InstructionArgs = {
    //     ???
    // }
    // let tx = createMetadataAccountV3(
    //     umi,
    //     {
    //         ...accounts,
    //         ...args
    //     }
    // )
    // let result = await tx.sendAndConfirm(umi);
    // console.log(bs58.encode(result.signature));
  } catch (e) {
    console.error(`Oops, something went wrong: ${e}`);
  }
})();
