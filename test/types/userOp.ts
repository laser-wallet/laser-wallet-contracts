import { LaserOp, UserOp } from "./types";
import {ethers} from "ethers";

const mock = 1000000000;

export const laserOp: LaserOp = {
    sender: "",
    nonce: "",
    callData: "",
    callGas: mock,
    verificationGas: mock,
    preVerificationGas: mock,
    maxFeePerGas: mock,
    maxPriorityFeePerGas: mock,
    paymaster: "",
    paymasterData: "0x"
};

export const userOp: UserOp = {
    sender: "",
    nonce: "",
    initCode: "0x",
    callData: "",
    callGas: mock,
    verificationGas: mock,
    preVerificationGas: mock,
    maxFeePerGas: mock,
    maxPriorityFeePerGas: mock,
    paymaster: ethers.constants.AddressZero,
    paymasterData: "0x",
    signature: "0x"
};
