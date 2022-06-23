import { BigNumber, ethers, Signer, Wallet, Contract } from "ethers";
import { Domain, types } from "../types";
import { Transaction, LaserTypes } from "../types";

export async function signTypedData(
    signer: Wallet,
    domain: Domain,
    laserTypes: LaserTypes
): Promise<string> {
    const signature = await signer._signTypedData(domain, types, laserTypes);
    return signature;
}

export async function sign(signer: Signer, hash: string): Promise<string> {
    const typedDataHash = ethers.utils.arrayify(hash);
    const signature = (await signer.signMessage(typedDataHash))
        .replace(/1b$/, "1f")
        .replace(/1c$/, "20");
    return signature;
}
