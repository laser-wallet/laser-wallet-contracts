import { Console } from "console";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { encodeFunctionData } from "./utils";
import { LaserWallet } from "../../typechain-types/LaserWallet";

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
    wallet: Contract;
};

export async function factorySetup(
    _singleton: string
): Promise<ReturnFactorySetup> {
    const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");

    const proxyFactory = await ProxyFactory.deploy(_singleton);

    return {
        address: proxyFactory.address,
        factory: proxyFactory,
    };
}

export async function walletSetup(
    owner: string,
    guardians: string[],
    _entryPoint: string
): Promise<ReturnWalletSetup> {
    const LaserWallet = await ethers.getContractFactory("LaserWallet");
    const singleton = await LaserWallet.deploy();
    const singletonAddress = singleton.address;
    const { address, factory } = await factorySetup(singletonAddress);
    const initializer = encodeFunctionData(abi, "init", [
        owner,
        guardians,
        _entryPoint,
    ]);
    let _wallet: LaserWallet;
    const transaction = await factory.createProxy(initializer);
    const receipt = await transaction.wait();
    const proxyAddress = receipt.events[1].args.proxy;
    return {
        address: proxyAddress,
        wallet: await ethers.getContractAt(abi, proxyAddress),
    };
}
