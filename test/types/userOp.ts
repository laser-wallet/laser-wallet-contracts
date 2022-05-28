import { LaserOp, UserOp } from "./types";
import {ethers} from "ethers";

const mock = 1000000000;

export const laserOp: LaserOp = {
    sender: "",
    nonce: "",
    callData: "",
    callGas: 150000,
    verificationGas: 800000,
    preVerificationGas: 50000,
    maxFeePerGas: 1000000000,
    maxPriorityFeePerGas: 1000000000,
    paymaster: "",
    paymasterData: "0x"
};

export const userOp: UserOp = {
    sender: "",
    nonce: "",
    initCode: "0x",
    callData: "",
    callGas: 150000,
    verificationGas: 800000,
    preVerificationGas: 50000,
    maxFeePerGas: 1000000000,
    maxPriorityFeePerGas: 1000000000,
    paymaster: ethers.constants.AddressZero,
    paymasterData: "0x",
    signature: "0x"
};
