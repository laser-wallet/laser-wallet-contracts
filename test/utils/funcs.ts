import { Contract, Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { encodeFunctionData } from "./utils";
import { Address, userOp, Domain } from "../types";
import { EIP712Sig } from "./sign";

export async function lock(
    signer: Wallet,
    entryPoint: Contract,
    domain: Domain,
    sender: Address,
    nonce: number,
    callData: string
): Promise<void> {
    const txMessage = {
        sender: sender,
        nonce: nonce,
        callData: callData,
        callGas: userOp.callGas,
        verificationGas: userOp.verificationGas,
        preVerificationGas: userOp.preVerificationGas,
        maxFeePerGas: userOp.maxFeePerGas,
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
        paymaster: userOp.paymaster,
        paymasterData: userOp.paymasterData,
    };
    userOp.sender = sender;
    userOp.nonce = nonce;
    userOp.callData = callData;
    userOp.signature = await EIP712Sig(signer, domain, txMessage);

    await entryPoint.handleOps([userOp], sender);
}
