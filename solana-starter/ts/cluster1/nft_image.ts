// Image UrI - https://devnet.irys.xyz/EEjCMzzfYKZB9izyVS2NTKg6WVVP2yA7L7BBnjE9HCoU

import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { readFile } from "fs/promises";
import wallet from "../turbin3-wallet.json";

// Create a devnet connection
const umi = createUmi("https://api.devnet.solana.com");

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(
  irysUploader({
    address: "https://devnet.irys.xyz/",
  }),
);
umi.use(signerIdentity(signer));

(async () => {
  try {
    const image = await readFile("../My Rug.png");

    const generic_file = createGenericFile(image, "The carpet", {
      contentType: "image/png",
    });

    const myUri = await umi.uploader.upload([generic_file]);

    console.log("Your image URI: ", myUri);
  } catch (error) {
    console.log("Oops.. Something went wrong", error);
  }
})();
