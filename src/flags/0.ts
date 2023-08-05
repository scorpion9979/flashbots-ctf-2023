import MevShareClient, {
  IPendingTransaction,
} from "@flashbots/mev-share-client";
import { JsonRpcProvider, Wallet } from "ethers";
import { backrunAttempt, recentPendingTxHashes } from "../utils";

export async function claimFlag0(mevshare: MevShareClient, wallet: Wallet, provider: JsonRpcProvider) {
  // bot only executes one trade, so get the nonce now
  const nonce = await wallet.getNonce("latest");
  mevshare.on("transaction", async (pendingTx: IPendingTransaction) => {
    console.log(pendingTx);
    const currentBlockNumber = await provider.getBlockNumber()
    if (!pendingTx || !pendingTx.to) { return }
    const tx = {
      to: pendingTx.to,
      data: "",
      from: wallet.address
    }
    backrunAttempt(mevshare, wallet, provider, tx, nonce, currentBlockNumber, pendingTx.hash)
    recentPendingTxHashes.push({ txHash: pendingTx.hash, blockNumber: currentBlockNumber })
  });
}
