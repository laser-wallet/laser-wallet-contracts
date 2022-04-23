import { BigNumber } from "ethers";
import { string } from "hardhat/internal/core/params/argumentTypes";

export interface TxMessage {
    to: string;
    value: number | BigNumber;
    data: string;
    nonce: string | number;
}

export interface SafeTx {
    to: string;
    value: BigNumber | number;
    data: string;
    signature: string;
}

export interface LaserOp {
    sender: string;
    nonce: string | number;
    callData: string;
    callGas: string | number | BigNumber;
    verificationGas: string | number | BigNumber;
    preVerificationGas: string | number | BigNumber;
    maxFeePerGas: string | number | BigNumber;
    maxPriorityFeePerGas: string | number | BigNumber;
    paymaster: string;
    paymasterData: string;
}

export interface UserOp {
    sender: string;
    nonce: string | number;
    initCode: string;
    callData: string;
    callGas: string | number | BigNumber;
    verificationGas: string | number | BigNumber;
    preVerificationGas: string | number | BigNumber;
    maxFeePerGas: string | number | BigNumber;
    maxPriorityFeePerGas: string | number | BigNumber;
    paymaster: string;
    paymasterData: string;
    signature: string;
}
