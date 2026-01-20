// MetaData URI - https://devnet.irys.xyz/BayH98JFguHHP6C2GkFcs6uogeGbqLa5DquikdnjdYXL

import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
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
    // Follow this JSON structure
    // https://docs.metaplex.com/programs/token-metadata/changelog/v1.0#json-structure

    const image =
      "https://devnet.irys.xyz/EEjCMzzfYKZB9izyVS2NTKg6WVVP2yA7L7BBnjE9HCoU";
    const metadata = {
      name: "Carpet Rug",
      symbol: "CRUG",
      description: "A Carpet Rug",
      image: image,
      attributes: [
        {
          trait_type: "type",
          value: "carpet",
        },
        {
          trait_type: "color",
          value: "9",
        },
        {
          trait_type: "theme",
          value: "vintage",
        },
      ],
      properties: {
        files: [
          {
            type: "image/png",
            uri: image,
          },
        ],
      },
      creators: [
        {
          address: "GKhW6dKV8J8qgPuQe6ZE9ZRPCo9x5NZT1jNnvwwYxjt",
          verified: false,
          share: 100,
        },
      ],
    };
    const myUri = await umi.uploader.uploadJson(metadata);
    console.log("Your metadata URI: ", myUri);
  } catch (error) {
    console.log("Oops.. Something went wrong", error);
  }
})();
