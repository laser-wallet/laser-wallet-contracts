import { BigNumber, ethers, Signer, Wallet,Contract } from "ethers";
import { Domain, types } from "../types/EIP712";
import { TxMessage, LaserOp, userOp, SafeTx } from "../types";

export async function signTypedData(
    signer: Wallet,
    domain: Domain,
    destination: string,
    _value?: BigNumber | string | number,
    _data?: string,
    _nonce?: number
): Promise<string> {
    const txMessage = {
        to: destination,
        value: _value ? _value : 0,
        data: _data ? _data : "0x",
        nonce: _nonce ? _nonce : 0
    };
    const signature = await signer._signTypedData(domain, types, txMessage);
    return signature;
}

export async function EIP712Sig(
    signer: Wallet,
    domain: Domain,
    to: string,
    callData: string
): Promise<string> {
    const types = {
        LaserOp: [
            { type: "address", name: "sender" },
            { type: "uint256", name: "nonce" },
            { type: "bytes", name: "callData" },
            { type: "uint256", name: "callGas" },
            { type: "uint256", name: "verificationGas" },
            { type: "uint256", name: "preVerificationGas" },
            { type: "uint256", name: "maxFeePerGas" },
            { type: "uint256", name: "maxPriorityFeePerGas" },
            { type: "address", name: "paymaster" },
            { type: "bytes", name: "paymasterData" }
        ]
    };

    const txMessage = {
        sender: to,
        nonce: 0,
        callData: callData,
        callGas: 200000,
        verificationGas: 100000,
        preVerificationGas: 100000,
        maxFeePerGas: 1100000000,
        maxPriorityFeePerGas: 1100000000,
        paymaster: ethers.constants.AddressZero,
        paymasterData: "0x"
    };

    const signature = await signer._signTypedData(domain, types, txMessage);
    return signature;
}

export async function sign(signer: Signer, hash: string): Promise<string> {
    const typedDataHash = ethers.utils.arrayify(hash);
    const signature = (await signer.signMessage(typedDataHash))
        .replace(/1b$/, "1f")
        .replace(/1c$/, "20");
    return signature;
}


export async function internalSignature(signer: Wallet, internalTx: SafeTx, wallet: Contract) : Promise<string> {
    const hash = await wallet.getTransactionHash(internalTx.to, internalTx.value, internalTx.data, 0);
    return await sign(signer, hash);
}