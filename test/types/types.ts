
import { BigNumber } from "ethers"
import { string } from "hardhat/internal/core/params/argumentTypes"

export interface TxMessage {
    to: string;
    value: string | number | BigNumber;
    data: string;
    operation: number | string;
    safeTxGas: number | string;
    baseGas: number | string;
    gasPrice: number | string;
    gasToken: string;
    refundReceiver: string;
    nonce: string | number | BigNumber;
}

export interface SafeTx {
    to: string;
    value: BigNumber | number | string;
    data: string;
    operation: number;
    safeTxGas: number | string;
    baseGas: number | string;
    gasPrice: number | string;
    gasToken: string;
    refundReceiver: string;
    signature: string;
    specialOwner: string;
}

export interface UserOp  {
    sender: string;
    nonce: Number | string;
    initCode: string;
    callData: string;
    callGas: Number;
    verificationGas: number | BigNumber;
    preVerificationGas: number | BigNumber;
    maxFeePerGas: number | BigNumber;
    maxPriorityFeePerGas: number | BigNumber;
    paymaster: string;
    paymasterData: string;
    signature: string;
}
