
import { BigNumber } from "ethers"

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



