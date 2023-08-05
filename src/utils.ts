import MevShareClient from "@flashbots/mev-share-client";
import { ContractTransaction, JsonRpcProvider, Wallet } from "ethers";

import dotenv from "dotenv";
dotenv.config()

const { RPC_URL, EXECUTOR_KEY, FB_REPUTATION_KEY } = process.env;

if (!(RPC_URL && EXECUTOR_KEY && FB_REPUTATION_KEY)) {
  throw new Error("Missing environment variables");
}

// create web3 provider & wallets, connect to mev-share
export const provider = new JsonRpcProvider(RPC_URL)
export const executorWallet = new Wallet(EXECUTOR_KEY, provider)
export const authSigner = new Wallet(FB_REPUTATION_KEY, provider)
export const mevshare = new MevShareClient(authSigner, {
  streamUrl: "https://mev-share-goerli.flashbots.net",
  apiUrl: "https://relay-goerli.flashbots.net",
});

// discount we expect from the backrun trade (basis points):
const DISCOUNT_IN_BPS = 40n;
// try sending a backrun bundle for this many blocks:
export const BLOCKS_TO_TRY = 24;

const TX_GAS_LIMIT = 400000;
const MAX_GAS_PRICE = 20n;
const MAX_PRIORITY_FEE = 5n;
const GWEI = 10n ** 9n;

export async function getSignedBackrunTx(
  wallet: Wallet,
  tx: ContractTransaction,
  nonce: number
) {
  const txFull = {
    ...tx,
    chainId: 5,
    maxFeePerGas: MAX_GAS_PRICE * GWEI,
    maxPriorityFeePerGas: MAX_PRIORITY_FEE * GWEI,
    gasLimit: TX_GAS_LIMIT,
    nonce: nonce,
  };
  return wallet.signTransaction(txFull);
}

export async function backrunAttempt(
  tx: ContractTransaction,
  nonce: number,
  currentBlockNumber: number,
  pendingTxHash: string
) {
  const backrunSignedTx = await getSignedBackrunTx(executorWallet, tx, nonce);
  try {
    const sendBundleResult = await mevshare.sendBundle({
      inclusion: { block: currentBlockNumber + 1 },
      body: [
        { hash: pendingTxHash },
        { tx: backrunSignedTx, canRevert: false },
      ],
    });
    console.log("Bundle Hash: " + sendBundleResult.bundleHash);
  } catch (e) {
    console.log("err", e);
  }
}

export async function backrunAttemptTriple(
  tx: ContractTransaction,
  nonce: number,
  currentBlockNumber: number,
  pendingTxHash: string
) {
  const backrunSignedTx0 = await getSignedBackrunTx(executorWallet, tx, nonce);
  const backrunSignedTx1 = await getSignedBackrunTx(executorWallet, tx, nonce + 1);
  const backrunSignedTx2 = await getSignedBackrunTx(executorWallet, tx, nonce + 2);
  try {
    const sendBundleResult = await mevshare.sendBundle({
      inclusion: { block: currentBlockNumber + 1 },
      body: [
        { 
          bundle: {
            inclusion: { block: currentBlockNumber + 1 },
            body: [
              { hash: pendingTxHash },
              { tx: backrunSignedTx0, canRevert: false },
              { tx: backrunSignedTx1, canRevert: false },
              { tx: backrunSignedTx2, canRevert: false },
            ]
        } }
      ],
    });
    console.log("Bundle Hash: " + sendBundleResult.bundleHash);
  } catch (e) {
    console.log("err", e);
  }
}
