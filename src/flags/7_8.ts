import { IPendingTransaction } from "@flashbots/mev-share-client";
import { StreamEventType } from "@flashbots/mev-share-client/build/api/interfaces";
import { BLOCKS_TO_TRY, backrunAttempt, executorWallet, mevshare, provider } from "../utils";
import { Contract, ethers } from "ethers";

const FLAG_ABI = [{"inputs":[{"internalType":"contract MevShareCaptureLogger","name":"_mevShareCaptureLogger","type":"address"}],"stateMutability":"payable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"newlyDeployedContract","type":"address"}],"name":"Activate","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"salt","type":"bytes32"}],"name":"ActivateBySalt","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[{"internalType":"bytes32","name":"salt","type":"bytes32"}],"name":"activateRewardBySalt","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"salt","type":"bytes32"}],"name":"activateRewardNewContract","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"destination","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"call","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"magicNumber","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proxyRegisterCapture","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const CHILD_ABI = [{"inputs":[],"stateMutability":"payable","type":"constructor"},{"inputs":[],"name":"activeBlock","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claimReward","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const FLAG_ADDRESS = "0x5eA0feA0164E5AA58f407dEBb344876b5ee10DEA"
const flag = new Contract(FLAG_ADDRESS, FLAG_ABI, executorWallet)

export async function claimFlag7_8() {
  // bot only executes one trade, so get the nonce now
  const nonce = await executorWallet.getNonce("latest");

  mevshare.on(StreamEventType.Transaction, async (pendingTx: IPendingTransaction) => {
    const currentBlockNumber = await provider.getBlockNumber()
    if (!pendingTx || !pendingTx.logs) { return }

    if(pendingTx.logs[0].address.toLowerCase() === FLAG_ADDRESS.toLowerCase()) {
      // activateRewardNewContract(bytes32 salt)
      if(pendingTx.logs[0].data.slice(0, 26) == "0x000000000000000000000000") {
        let recentPendingTxHashes: Array<{ txHash: string, blockNumber: number }> = []

        console.log("found activateRewardNewContract!")
        const childContractAddress = `0x${pendingTx.logs[0].data.slice(26)}`
        const childContract = new Contract(childContractAddress, CHILD_ABI, executorWallet)
        const tx = await childContract.claimReward.populateTransaction();
        backrunAttempt(tx, nonce, currentBlockNumber, pendingTx.hash).then(() => {
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
      // activateRewardBySalt(bytes32 salt)
      else {
        let recentPendingTxHashes: Array<{ txHash: string, blockNumber: number }> = []

        console.log("found activateRewardBySalt!")
        const salt = pendingTx.logs[0].data

        const initCodeHash = "0xbfc931f453933f31def120296fb4331728a1574fa502b53844147e818bd8558d"
        const childContractAddress = ethers.getCreate2Address(FLAG_ADDRESS,
          salt,
          initCodeHash
        );
        const childContract = new Contract(childContractAddress, CHILD_ABI, executorWallet)
        const tx = await childContract.claimReward.populateTransaction();
        backrunAttempt(tx, nonce, currentBlockNumber, pendingTx.hash).then(() => {
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
