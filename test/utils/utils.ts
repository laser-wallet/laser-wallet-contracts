import { ethers, Wallet, Contract, BigNumber } from "ethers";
// import { Domain, types, TxMessage, SafeTx, UserOp } from "../types";

// const {
//     abi
// } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

export function encodeFunctionData(
    abi: any,
    functionName: string,
    ..._params: any[]
): string {
    const params = _params[0];
    const iface = new ethers.utils.Interface(abi);
    const data = iface.encodeFunctionData(functionName, params);
    return data;
}

// export async function signMessage(
//     signer: Wallet,
//     domain: Domain,
//     txMessage: TxMessage
// ): Promise<string> {
//     const signature = await signer._signTypedData(domain, types, txMessage);
//     return signature.slice(2);
// }

// export function paddedSignature(_address: string): string {
//     const address = _address.slice(2);
//     const signatureVerifier = "000000000000000000000000" + address;
//     const dataPosition =
//         "00000000000000000000000000000000000000000000000000000000000000000";
//     const signatureType = "1";
//     const signature = signatureVerifier + dataPosition + signatureType;
//     return "0x" + signature;
// }

// export function contractSignature(_address: string): string {
//     const address = _address.slice(2);
//     const signatureVerifier = "000000000000000000000000" + address;
//     const dataPosition =
//         "00000000000000000000000000000000000000000000000000000000000000000";
//     const signatureType = "0";
//     const signature = signatureVerifier + dataPosition + signatureType;
//     return "0x" + signature;
// }

// export function execTransactionData(
//     to: string,
//     value: string,
//     data: string,
//     sig: string
// ): string {
//     return encodeFunctionData(abi, "execTransaction", [to, value, data, sig]);
// }

// export function changeThresholdData(threshold: number): string {
//     return encodeFunctionData(abi, "changeThreshold", [threshold]);
// }

// export function addOwnerWithThresholdData(
//     address: string,
//     threshold: number
// ): string {
//     return encodeFunctionData(abi, "addOwnerWithThreshold", [
//         address,
//         threshold
//     ]);
// }

// export function encodeCallData(to: string, value: number | string | BigNumber, data: string) : string {
//     const _data = encodeFunctionData(abi, "execFromEntryPoint", [to, value, data]);
//     return _data;
// }

// export function setupData(
//     owners: string[],
//     specialOwners: string[],
//     threshold: string | number,
//     entryPoint: string,
//     trustedAddresses: string[],
//     tokens: string[],
//     amount: string[]
// ): string {
//     return encodeFunctionData(abi, "setup", [
//         owners,
//         specialOwners,
//         threshold,
//         entryPoint,
//         trustedAddresses,
//         tokens,
//         amount
//     ]);
// }

// export async function execTx(wallet: Contract, tx: SafeTx) {
//     await wallet.execTransaction(
//         safeTx.to,
//         safeTx.value,
//         safeTx.data,
//         safeTx.signature
//     );
// }

// export const txMessage: TxMessage = {
//     to: "",
//     value: 0,
//     data: "0x",
//     nonce: 0
// };

// export const safeTx: SafeTx = {
//     to: "",
//     value: 0,
//     data: "",
//     signature: ""
// };
