import { Wallet, Contract, BigNumber, Signer } from "ethers";
import { ethers } from "hardhat";
import { Address, LaserTypes, Transaction } from "../types";
import { addressesForTest } from "./setup";
import { sign } from "./sign";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

export function encodeFunctionData(abi: any, functionName: string, ..._params: any[]): string {
    const params = _params[0];
    const iface = new ethers.utils.Interface(abi);
    const data = iface.encodeFunctionData(functionName, params);
    return data;
}

export async function getHash(wallet: Contract, transaction: Transaction): Promise<string> {
    const hash = await wallet.operationHash(
        transaction.to,
        transaction.value,
        transaction.callData,
        transaction.nonce,
        transaction.maxFeePerGas,
        transaction.maxPriorityFeePerGas,
        transaction.gasLimit
    );
    return hash;
}

export async function sendTx(wallet: Contract, transaction: Transaction, signer?: Signer) {
    if (signer) {
        const tx = await wallet
            .connect(signer)
            .exec(
                transaction.to,
                transaction.value,
                transaction.callData,
                transaction.nonce,
                transaction.maxFeePerGas,
                transaction.maxPriorityFeePerGas,
                transaction.gasLimit,
                transaction.signatures,
                {
                    gasLimit: transaction.gasLimit,
                }
            );
        const receipt = await tx.wait();
        return receipt;
    } else {
        const tx = await wallet.exec(
            transaction.to,
            transaction.value,
            transaction.callData,
            transaction.nonce,
            transaction.maxFeePerGas,
            transaction.maxPriorityFeePerGas,
            transaction.gasLimit,
            transaction.relayer,
            transaction.signatures,
            {
                gasLimit: transaction.gasLimit,
            }
        );
        const receipt = await tx.wait();
        return receipt;
    }
}

export async function generateTransaction(): Promise<Transaction> {
    const baseFee = (await ethers.provider.send("eth_getBlockByNumber", ["latest", true])).baseFeePerGas;
    const _maxPriorityFeePerGas = 2000000000;
    const _maxFeePerGas = 2 * baseFee + _maxPriorityFeePerGas;
    const { relayer } = await addressesForTest();
    return {
        to: "",
        value: 0,
        callData: "0x",
        nonce: 0,
        maxFeePerGas: _maxFeePerGas,
        maxPriorityFeePerGas: _maxPriorityFeePerGas,
        gasLimit: 200000,
        relayer: relayer,
        signatures: "0x",
    };
}

export async function fundWallet(sender: Signer, address: Address): Promise<void> {
    const oneEth = ethers.utils.parseEther("1");
    await sender.sendTransaction({
        to: address,
        value: oneEth,
    });
}

export async function lockWallet(wallet: Contract, guardian: Signer) {
    const tx = await generateTransaction();
    tx.to = wallet.address;
    tx.callData = encodeFunctionData(abi, "lock", []);
    const hash = await getHash(wallet, tx);
    tx.signatures = await sign(guardian, hash);
    await sendTx(wallet, tx);
}

export function isAddress(addresses: Address[], address: Address): boolean {
    let _isAddress = false;

    addresses.map((_address) => {
        if (_address.toLowerCase() === address.toLowerCase()) {
            _isAddress = true;
        }
    });

    return _isAddress;
}
