import { IPendingTransaction } from "@flashbots/mev-share-client";
import { StreamEventType } from "@flashbots/mev-share-client/build/api/interfaces";
import { BLOCKS_TO_TRY, backrunAttempt, executorWallet, mevshare, provider } from "../utils";
import { Contract } from "ethers";

const FLAG_ABI = [{"inputs":[{"internalType":"contract MevShareCaptureLogger","name":"_mevShareCaptureLogger","type":"address"}],"stateMutability":"payable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"lowerBound","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"upperBound","type":"uint256"}],"name":"Activate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[{"internalType":"uint256","name":"_lowerBound","type":"uint256"},{"internalType":"uint256","name":"_upperBound","type":"uint256"},{"internalType":"uint256","name":"_magicNumber","type":"uint256"}],"name":"activateRewardMagicNumber","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"activeBlock","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"destination","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"call","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_magicNumber","type":"uint256"}],"name":"claimReward","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const FLAG_ADDRESS = "0x118Bcb654d9A7006437895B51b5cD4946bF6CdC2"
const flag = new Contract(FLAG_ADDRESS, FLAG_ABI, executorWallet)

export async function claimFlag4() {
  // bot only executes one trade, so get the nonce now
  let recentPendingTxHashes: Array<{ txHash: string, blockNumber: number }> = []
  const nonce = await executorWallet.getNonce("latest");

  mevshare.on(StreamEventType.Transaction, async (pendingTx: IPendingTransaction) => {
    const currentBlockNumber = await provider.getBlockNumber()
    // data: {"logs":null,"txs":null,"mevGasPrice":"0x2faf080","gasUsed":"0x7530"}
    if (!pendingTx || !pendingTx.logs) { return }

    const lowerBound = parseInt(pendingTx.logs[0].data.slice(2, 66), 16)
    const upperBound = parseInt(pendingTx.logs[0].data.slice(66, 130), 16)

    const midPoint = Math.floor((lowerBound + upperBound) / 2)

    if (pendingTx.logs[0].address.toLowerCase() === FLAG_ADDRESS.toLowerCase() && upperBound - lowerBound <= 40) {
      console.log("found it!")

      // middle out!
      for (let i = midPoint; i <= upperBound; i++) {
        const tx = await flag.claimReward.populateTransaction(i);
        backrunAttempt(tx, nonce, currentBlockNumber, pendingTx.hash).then(() => {
          console.log("tried magic number", i)

          recentPendingTxHashes.push({ txHash: pendingTx.hash, blockNumber: currentBlockNumber })

          provider.on('block', ( blockNumber ) => {
            for (const recentPendingTxHash of recentPendingTxHashes) {
              console.log("pushing attempt")
              backrunAttempt(tx, nonce, blockNumber, recentPendingTxHash.txHash)
            }
            // Cleanup old pendingTxHashes
            recentPendingTxHashes = recentPendingTxHashes.filter(( recentPendingTxHash ) =>
              blockNumber > recentPendingTxHash.blockNumber + BLOCKS_TO_TRY)
          });
        })
      }

      for (let i = midPoint - 1; i >= lowerBound; i--) {
        const tx = await flag.claimReward.populateTransaction(i);
        backrunAttempt(tx, nonce, currentBlockNumber, pendingTx.hash).then(() => {
          console.log("tried magic number", i)

          recentPendingTxHashes.push({ txHash: pendingTx.hash, blockNumber: currentBlockNumber })

          provider.on('block', ( blockNumber ) => {
            for (const recentPendingTxHash of recentPendingTxHashes) {
              console.log("pushing attempt")
              backrunAttempt(tx, nonce, blockNumber, recentPendingTxHash.txHash)
            }
            // Cleanup old pendingTxHashes
            recentPendingTxHashes = recentPendingTxHashes.filter(( recentPendingTxHash ) =>
              blockNumber > recentPendingTxHash.blockNumber + BLOCKS_TO_TRY)
          });
        })
      }
    }
  });
}
