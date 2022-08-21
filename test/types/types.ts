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
    ],
};

export type Domain = {
    chainId: BigNumberish;
    verifyingContract: string;
};

export type Transaction = {
    to: Address;
    value: BigNumberish;
    callData: string;
    nonce: BigNumberish;
    signatures: string;
};

export type LaserTypes = {
    to: Address;
    value: BigNumberish;
    callData: string;
    nonce: BigNumberish;
};
