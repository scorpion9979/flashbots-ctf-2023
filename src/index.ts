import MevShareClient from "@flashbots/mev-share-client";
import { JsonRpcProvider, Wallet } from "ethers";

import dotenv from "dotenv";
import * as flags from "./flags";
dotenv.config()

const { RPC_URL, EXECUTOR_KEY, FB_REPUTATION_KEY } = process.env;

if (!(RPC_URL && EXECUTOR_KEY && FB_REPUTATION_KEY)) {
  throw new Error("Missing environment variables");
}

// create web3 provider & wallets, connect to mev-share
const provider = new JsonRpcProvider(RPC_URL)
const executorWallet = new Wallet(EXECUTOR_KEY, provider)
const authSigner = new Wallet(FB_REPUTATION_KEY, provider)
const mevshare = new MevShareClient(authSigner, {
  streamUrl: "https://mev-share-goerli.flashbots.net",
  apiUrl: "https://relay-goerli.flashbots.net",
});

async function main() {
  console.log("mev-share auth address: " + authSigner.address);
  console.log("executor address: " + executorWallet.address);

  await flags.claimFlag0(mevshare, executorWallet, provider);
}

main()
