import { BigNumber, BigNumberish } from "ethers";

export type Address = string;

export const types = {
    LaserOperation: [
        {
            type: "address",
            name: "to",
        },
        {
            type: "uint256",
            name: "value",
        },
        {
            type: "bytes",
            name: "callData",
        },
        {
            type: "uint256",
            name: "nonce",
        },
        {
            type: "uint256",
            name: "maxFeePerGas",
        },
        {
            type: "uint256",
            name: "maxPriorityFeePerGas",
        },
        {
            type: "uint256",
            name: "gasLimit",
        },
    ],
};

export type Domain = {
    chainId: BigNumberish;
    verifyingContract: string;
};

export interface Transaction {
    to: Address;
    value: BigNumberish;
    callData: string;
    nonce: BigNumberish;
    maxFeePerGas: BigNumberish;
    maxPriorityFeePerGas: BigNumberish;
    gasLimit: BigNumberish;
    signatures: string;
}

export interface LaserTypes {
    to: Address;
    value: BigNumberish;
    callData: string;
    nonce: BigNumberish;
    maxFeePerGas: BigNumberish;
    maxPriorityFeePerGas: BigNumberish;
    gasLimit: BigNumberish;
}
