import { LaserOp, UserOp } from "./types";
import { ethers } from "ethers";

const mock = 1000000000;

// export const laserOp: LaserOp = {
//     sender: "",
//     nonce: "",
//     callData: "",
//     callGas: 200000,
//     verificationGas: 100000,
//     preVerificationGas: 100000,
//     maxFeePerGas: 1000000000,
//     maxPriorityFeePerGas: 1000000000,
//     paymaster: "",
//     paymasterData: "0x"
// };

export const userOp: UserOp = {
    sender: "",
    nonce: "",
    initCode: "0x",
    callData: "",
    callGas: 2000000,
    verificationGas: 1000000,
    preVerificationGas: 1000000,
    maxFeePerGas: 10000000000,
    maxPriorityFeePerGas: 10000000000,
    paymaster: ethers.constants.AddressZero,
    paymasterData: "0x",
    signature: "0x",
};
