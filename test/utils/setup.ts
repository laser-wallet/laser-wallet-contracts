import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { encodeFunctionData } from "./utils";
import { Address } from "../types";
import { LaserWallet } from "../../typechain-types";
import { LaserProxyFactory } from "../../typechain-types";

const mock = ethers.Wallet.createRandom().address;
const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

const VERSION = "1.0.0";

type ReturnFactorySetup = {
    address: string;
    factory: Contract;
};

type ReturnWalletSetup = {
    address: string;
    wallet: LaserWallet;
};

export async function factorySetup(
    _singleton: string
): Promise<ReturnFactorySetup> {
    const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");

    const proxyFactory = (await ProxyFactory.deploy(_singleton)) as LaserProxyFactory;

    return {
        address: proxyFactory.address,
        factory: proxyFactory,
    };
}

export async function walletSetup(
    owner: Address,
    recoveryOwners: Address[],
    guardians: Address[]
): Promise<ReturnWalletSetup> {
    const LaserWallet = await ethers.getContractFactory("LaserWallet");
    const singleton = (await LaserWallet.deploy()) as LaserWallet;
    const singletonAddress = singleton.address;
    const { address, factory } = await factorySetup(singletonAddress);
    const initializer = encodeFunctionData(abi, "init", [
        owner,
        recoveryOwners,
        guardians,
    ]);
    const transaction = await factory.createProxy(initializer);
    const receipt = await transaction.wait();
    const proxyAddress = receipt.events[1].args.proxy;
    const wallet = (await ethers.getContractAt(abi, proxyAddress)) as LaserWallet;
    return {
        address: proxyAddress,
        wallet: wallet,
    };
}
