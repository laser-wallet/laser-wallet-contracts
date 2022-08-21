import { BigNumber, ethers, Signer, Wallet, Contract } from "ethers";
import { Domain, LaserTypes, types } from "../types";
import { Transaction } from "../types";

export async function signTypedData(signer: Wallet, domain: Domain, transaction: Transaction): Promise<string> {
    const laserTypes: LaserTypes = {
        to: transaction.to,
        value: transaction.value,
        callData: transaction.callData,
        nonce: transaction.nonce,
    };
    return signer._signTypedData(domain, types, laserTypes);
}

export async function sign(signer: Signer, hash: string): Promise<string> {
    const typedDataHash = ethers.utils.arrayify(hash);
    const signature = (await signer.signMessage(typedDataHash)).replace(/1b$/, "1f").replace(/1c$/, "20");
    return signature;
}
