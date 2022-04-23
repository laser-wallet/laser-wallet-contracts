export const types = {
    SafeTx: [
        { type: "address", name: "to" },
        { type: "uint256", name: "value" },
        { type: "bytes", name: "data" },
        { type: "uint256", name: "nonce" }
    ]
};

export const userOpTypes = {
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
export type Domain = {
    chainId: number | string;
    verifyingContract: string;
};
