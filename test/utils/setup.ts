import { Contract, Signer } from "ethers";
import { TxMessage, SafeTx, UserOp } from "../types";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { encodeFunctionData, paddedSignature } from "./utils";
import {
    addressZero,
    specialOwner,
    owner1,
    owner2,
    owner3,
    SENTINEL
} from "./constants";

const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

// Init parameters to setup the wallet for the tests.
// They can be modified.
export const THRESHOLD = 3;
export const OWNERS = [
    specialOwner.address,
    owner1.address,
    owner2.address,
    owner3.address
];
export const SPECIAL_OWNERS = [specialOwner.address];

type ReturnFactorySetup = {
    address: string;
    factory: Contract;
};

type ReturnWalletSetup = {
    address: string;
    wallet: Contract;
};

export async function factorySetup(
    _singleton: string
): Promise<ReturnFactorySetup> {
    const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
    const proxyFactory = await ProxyFactory.deploy(_singleton);

    return {
        address: proxyFactory.address,
        factory: proxyFactory
    };
}

export async function walletSetup(
    relayer: Signer,
    _owners?: string[],
    _specialOwners?: string[],
    _threshold?: number,
    _entryPoint?: string,
    _ethSpendingLimit?: string | number | BigNumber
): Promise<ReturnWalletSetup> {
    const LaserWallet = await ethers.getContractFactory("LaserWallet");
    const singleton = await LaserWallet.deploy();
    const singletonAddress = singleton.address;
    const { address, factory } = await factorySetup(singletonAddress);
    const ENTRY_POINT = await ethers.getContractFactory("TestEntryPoint");
    const entryPoint = await ENTRY_POINT.deploy(SENTINEL, 0, 0);
    const initializer = encodeFunctionData(abi, "setup", [
        _owners ? _owners : OWNERS,
        _specialOwners ? _specialOwners : SPECIAL_OWNERS,
        _threshold ? _threshold : THRESHOLD,
        _entryPoint ? _entryPoint : entryPoint.address, // cannot be an eoa
        _ethSpendingLimit ? _ethSpendingLimit : 0
    ]);
    const transaction = await factory.createProxy(initializer);
    const receipt = await transaction.wait();
    let proxyAddress: string;
    const ethSpendingLimit =
        _ethSpendingLimit != undefined && _ethSpendingLimit > 0 ? true : false;
    if (!ethSpendingLimit) {
        proxyAddress = receipt.events[1].args.proxy;
    } else {
        proxyAddress = receipt.events[2].args.proxy;
    }

    return {
        address: proxyAddress,
        wallet: new ethers.Contract(proxyAddress, abi, relayer)
    };
}

export async function walletSetup2(
    relayer: Signer,
    _owners?: string[],
    _specialOwners?: string[],
    _threshold?: number,
    _trustedAddresses?: string[],
    _ethSpendingLimit?: string | number | BigNumber
) {
    const LaserWallet = await ethers.getContractFactory("LaserWallet");
    const singleton = await LaserWallet.deploy();
    const singletonAddress = singleton.address;
    const { address, factory } = await factorySetup(singletonAddress);
    const ENTRY_POINT = await ethers.getContractFactory("TestEntryPoint");
    const entryPoint = await ENTRY_POINT.deploy(SENTINEL, 0, 0);
    const initializer = encodeFunctionData(abi, "setup", [
        _owners ? _owners : OWNERS,
        _specialOwners ? _specialOwners : SPECIAL_OWNERS,
        _threshold ? _threshold : THRESHOLD,
        entryPoint.address, // cannot be an eoa
        _trustedAddresses ? _trustedAddresses : [],
        _ethSpendingLimit ? _ethSpendingLimit : 0
    ]);
    const transaction = await factory.createProxy(initializer);
    const receipt = await transaction.wait();
    let proxyAddress: string;
    const trustedAddresses = _trustedAddresses != undefined ? true : false;
    const ethSpendingLimit =
        _ethSpendingLimit != undefined && _ethSpendingLimit > 0 ? true : false;
    if (!trustedAddresses && !ethSpendingLimit) {
        proxyAddress = receipt.events[1].args.proxy;
    } else if (
        (ethSpendingLimit && !trustedAddresses) ||
        (trustedAddresses && !ethSpendingLimit)
    ) {
        proxyAddress = receipt.events[2].args.proxy;
    } else {
        proxyAddress = receipt.events[3].args.proxy;
    }

    return {
        address2: proxyAddress,
        wallet2: new ethers.Contract(proxyAddress, abi, relayer)
    };
}

// Checks that the setup test environment is correct.
export async function guardian(address: string) {
    const MSG = "Incorrect Setup";
    const wallet = await ethers.getContractAt(abi, address);
    const owners = await wallet.getOwners();
    const specialOwners = await wallet.getSpecialOwners();
    const threshold = await wallet.getThreshold();
    if (owners.length != OWNERS.length) {
        throw Error(MSG);
    } else if (specialOwners.length != SPECIAL_OWNERS.length) {
        throw Error(MSG);
    } else if (threshold != THRESHOLD) {
        throw Error(MSG);
    } else {
        for (let i = 0; i < owners.length; i++) {
            if (owners[i].toLowerCase() != OWNERS[i].toLowerCase()) {
                throw Error(MSG);
            }
            if (
                specialOwners[0].toLowerCase() !=
                SPECIAL_OWNERS[0].toLowerCase()
            ) {
                throw Error(MSG);
            }
        }
    }
}
