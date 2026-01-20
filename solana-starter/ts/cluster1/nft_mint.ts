// https://explorer.solana.com/tx/2H9nZ1qSyaNgk31SN83LG3ArUrH5JiKfAT9RW4t8L4WzUJdHhJYRQt23s5CLB8fHfdb185GsqhHTs95TAwnn8rcn?cluster=devnet
// Mint Address:  yXFBTrii1DRJnRsyUNm7x5U2sHcjn5FbZDU5SGTzaPw

import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createSignerFromKeypair,
  generateSigner,
  percentAmount,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

import base58 from "bs58";
import wallet from "../turbin3-wallet.json";

const RPC_ENDPOINT = "https://api.devnet.solana.com";
const umi = createUmi(RPC_ENDPOINT);

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const myKeypairSigner = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(myKeypairSigner));
umi.use(mplTokenMetadata());

const mint = generateSigner(umi);

(async () => {
  let tx = createNft(umi, {
    mint,
    name: "Carpet Rug",
    sellerFeeBasisPoints: percentAmount(5),
    uri: "https://devnet.irys.xyz/BayH98JFguHHP6C2GkFcs6uogeGbqLa5DquikdnjdYXL",
    creators: [
      {
        address: publicKey("GKhW6dKV8J8qgPuQe6ZE9ZRPCo9x5NZT1jNnvwwYxjt"),
        verified: false,
        share: 100,
      },
    ],
  });
  let result = await tx.sendAndConfirm(umi);
  const signature = base58.encode(result.signature);

  console.log(
    `Succesfully Minted! Check out your TX here:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`,
  );

  console.log("Mint Address: ", mint.publicKey);
})();
