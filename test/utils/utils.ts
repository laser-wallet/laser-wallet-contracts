import { Wallet, Contract, BigNumber, Signer, BigNumberish } from "ethers";
import { ethers, deployments } from "hardhat";
import { LaserWallet } from "../../typechain-types";
import { addrZero } from "../constants/constants";
import { Address, LaserTypes, Transaction } from "../types";
import { addressesForTest } from "./setup";
import { sign } from "./sign";

export function encodeFunctionData(abi: any, functionName: string, ..._params: any[]): string {
    const params = _params[0];
    const iface = new ethers.utils.Interface(abi);
    const data = iface.encodeFunctionData(functionName, params);
    return data;
}

export async function getHash(wallet: LaserWallet, transaction: Transaction): Promise<string> {
    return wallet.operationHash(transaction.to, transaction.value, transaction.callData, transaction.nonce);
}

export async function getRecoveryHash(wallet: LaserWallet, callData: string): Promise<string> {
    const chainId = await wallet.getChainId();
    const nonce = await wallet.nonce();
    const address = wallet.address;

    const dataHash = ethers.utils.solidityKeccak256(
        ["uint256", "bytes", "address", "uint256"],
        [nonce, ethers.utils.keccak256(callData), address, chainId]
    );
    return dataHash;
}

export async function sendTx(wallet: Contract, transaction: Transaction, signer?: Signer) {
    if (signer) {
        const tx = await wallet
            .connect(signer)
            .exec(transaction.to, transaction.value, transaction.callData, transaction.nonce, transaction.signatures);
        const receipt = await tx.wait();
        return receipt;
    } else {
        const tx = await wallet.exec(
            transaction.to,
            transaction.value,
            transaction.callData,
            transaction.nonce,
            transaction.signatures
        );
        const receipt = await tx.wait();
        return receipt;
    }
}

export function generateTransaction(): Transaction {
    return {
        to: "",
        value: 0,
        callData: "0x",
        nonce: 0,
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

export function isAddress(addresses: Address[], address: Address): boolean {
    let _isAddress = false;

    addresses.map((_address) => {
        if (_address.toLowerCase() === address.toLowerCase()) {
            _isAddress = true;
        }
    });

    return _isAddress;
}

export async function getConfigTimestamp(wallet: LaserWallet): Promise<BigNumber> {
    const config = await wallet.getConfig();
    return config.configTimestamp;
}

export async function getNewOwner(wallet: LaserWallet): Promise<Address> {
    const config = await wallet.getConfig();
    return config.newOwner;
}

export async function isWalletLocked(wallet: LaserWallet): Promise<boolean> {
    const config = await wallet.getConfig();
    return config._isLocked;
}
