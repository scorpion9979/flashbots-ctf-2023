import { IPendingTransaction } from "@flashbots/mev-share-client";
import { StreamEventType } from "@flashbots/mev-share-client/build/api/interfaces";
import { BLOCKS_TO_TRY, backrunAttemptTriple, executorWallet, mevshare, provider } from "../utils";
import { Contract } from "ethers";

const FLAG_ABI = [{"inputs":[{"internalType":"contract MevShareCaptureLogger","name":"_mevShareCaptureLogger","type":"address"}],"stateMutability":"payable","type":"constructor"},{"anonymous":false,"inputs":[],"name":"Activate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"activateRewardTriple","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"activeBlock","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"destination","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"call","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"claimReward","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const FLAG_ADDRESS = "0x1eA6Fb65BAb1f405f8Bdb26D163e6984B9108478"
const flag = new Contract(FLAG_ADDRESS, FLAG_ABI, executorWallet)

export async function claimFlag9() {
  // bot only executes one trade, so get the nonce now
  let recentPendingTxHashes: Array<{ txHash: string, blockNumber: number }> = []
  const nonce = await executorWallet.getNonce("latest");
  const tx = await flag.claimReward.populateTransaction();
  mevshare.on(StreamEventType.Transaction, async (pendingTx: IPendingTransaction) => {
    const currentBlockNumber = await provider.getBlockNumber()
    if (!pendingTx || !pendingTx.logs) { return }
    if (pendingTx.logs[0].address.toLowerCase() === FLAG_ADDRESS.toLowerCase()) {
      console.log("found it!")
      await backrunAttemptTriple(tx, nonce, currentBlockNumber, pendingTx.hash)
      recentPendingTxHashes.push({ txHash: pendingTx.hash, blockNumber: currentBlockNumber })
    }
  });

  provider.on('block', async ( blockNumber ) => {
    for (const recentPendingTxHash of recentPendingTxHashes) {
      console.log("pushing attempt")
      await backrunAttemptTriple(tx, nonce, blockNumber, recentPendingTxHash.txHash)
    }
    // Cleanup old pendingTxHashes
    recentPendingTxHashes = recentPendingTxHashes.filter(( recentPendingTxHash ) =>
      blockNumber > recentPendingTxHash.blockNumber + BLOCKS_TO_TRY)
  });
}
