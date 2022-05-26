import { Console } from "console";
import { Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import { encodeFunctionData } from "./utils";

const mock = ethers.Wallet.createRandom().address;
const {
  abi
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
    factory: proxyFactory
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
    _entryPoint
  ]);
  const transaction = await factory.createProxy(initializer);
  const receipt = await transaction.wait();
  const proxyAddress = receipt.events[1].args.proxy;
  return {
    address: proxyAddress,
    wallet: await ethers.getContractAt(abi, proxyAddress)
  };
}

export async function initTests(address: string): Promise<void> {
  const ERROR_MSG = "Incorrect Setup: Check utils/setup.ts";
  const owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const guardians = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  ];
  const entryPoint = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const wallet = await ethers.getContractAt(abi, address);
  const walletOwner = await wallet.owner();
  const walletEntryPoint = await wallet.entryPoint();
  if (walletEntryPoint.toLowerCase() !== entryPoint.toLowerCase()) {
    throw Error(ERROR_MSG);
  }
  if (walletOwner.toLowerCase() !== owner.toLowerCase()) {
    throw Error(ERROR_MSG);
  }
  if ((await wallet.guardianCount()).toString() !== "2") {
    throw Error(ERROR_MSG);
  }
  const walletGuardians = await wallet.getGuardians();
  for (let i = 0; i < walletGuardians.length; i++) {
    const walletGuardian = walletGuardians[i];
    const guardian = guardians[i];
    if (guardian.toLowerCase() !== walletGuardian.toLowerCase()) {
      throw Error(ERROR_MSG);
    }
  }
  const walletVersion = await wallet.VERSION();
  if (walletVersion !== VERSION) {
    throw Error(ERROR_MSG);
  }
}
