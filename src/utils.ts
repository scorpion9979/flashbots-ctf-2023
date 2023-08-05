import MevShareClient from "@flashbots/mev-share-client";
import { ContractTransaction, JsonRpcProvider, Wallet } from "ethers";

// discount we expect from the backrun trade (basis points):
const DISCOUNT_IN_BPS = 40n;
// try sending a backrun bundle for this many blocks:
const BLOCKS_TO_TRY = 24;

const TX_GAS_LIMIT = 400000;
const MAX_GAS_PRICE = 20n;
const MAX_PRIORITY_FEE = 5n;
const GWEI = 10n ** 9n;

export let recentPendingTxHashes: Array<{ txHash: string, blockNumber: number }> = []

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

let recursive_entry = false;

export async function backrunAttempt(
  mevshare: MevShareClient,
  wallet: Wallet,
  provider: JsonRpcProvider,
  tx: ContractTransaction,
  nonce: number,
  currentBlockNumber: number,
  pendingTxHash: string
) {
  const backrunSignedTx = await getSignedBackrunTx(wallet, tx, nonce);
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

  !recursive_entry ?? provider.on('block', ( blockNumber ) => {
    recursive_entry = true;
    for (const recentPendingTxHash of recentPendingTxHashes) {
      console.log(recentPendingTxHash)
      backrunAttempt(mevshare, wallet, provider, tx, nonce, blockNumber, recentPendingTxHash.txHash)
    }
    // Cleanup old pendingTxHashes
    recentPendingTxHashes = recentPendingTxHashes.filter(( recentPendingTxHash ) =>
      blockNumber > recentPendingTxHash.blockNumber + BLOCKS_TO_TRY)
  });
}
