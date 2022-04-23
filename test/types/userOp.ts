import { addressZero } from "../utils";
import { LaserOp, UserOp } from "./types";

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
    paymaster: addressZero,
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
    paymaster: addressZero,
    paymasterData: "0x",
    signature: ""
};
