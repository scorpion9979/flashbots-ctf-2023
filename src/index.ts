import * as flags from "./flags";
import { authSigner, executorWallet } from "./utils";

async function main() {
  console.log("mev-share auth address: " + authSigner.address);
  console.log("executor address: " + executorWallet.address);

  await flags.claimFlag3();
}

main()
