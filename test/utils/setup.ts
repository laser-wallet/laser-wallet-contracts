import { BigNumberish, Contract, Signer, Wallet } from "ethers";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { encodeFunctionData } from "./utils";
import { sign } from "./sign";
import { Address } from "../types";
import { LaserWallet, LaserWallet__factory } from "../../typechain-types";
import { LaserFactory } from "../../typechain-types";
import { addrZero, ownerWallet } from "../constants/constants";

require("dotenv").config();

type ReturnWalletSetup = {
    address: Address;
    wallet: LaserWallet;
    factoryAddress: Address;
    factory: Contract;
};

export type AddressesForTest = {
    owner: Address;
    recoveryOwners: Address[];
    guardians: Address[];
};

export type SignersForTest = {
    ownerSigner: Signer;
    recoveryOwner1Signer: Signer;
    recoveryOwner2Signer: Signer;
    guardian1Signer: Signer;
    guardian2Signer: Signer;
};

export async function addressesForTest(): Promise<AddressesForTest> {
    const [owner, recoveryOwner1, recoveryOwner2, guardian1, guardian2] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();

    const recoveryOwners = [await recoveryOwner1.getAddress(), await recoveryOwner2.getAddress()];

    const guardians = [await guardian1.getAddress(), await guardian2.getAddress()];

    return {
        owner: ownerAddress,
        recoveryOwners: recoveryOwners,
        guardians: guardians,
    };
}

export function getInitializer(
    owner: Address,
    guardians: Address[],
    recoveryOwners: Address[],
    ownerSignature: string
): string {
    return encodeFunctionData(LaserWallet__factory.abi, "init", [owner, guardians, recoveryOwners, ownerSignature]);
}

export async function signersForTest(): Promise<SignersForTest> {
    const [owner, recoveryOwner1, recoveryOwner2, guardian1, guardian2] = await ethers.getSigners();
    return {
        ownerSigner: owner,
        recoveryOwner1Signer: recoveryOwner1,
        recoveryOwner2Signer: recoveryOwner2,
        guardian1Signer: guardian1,
        guardian2Signer: guardian2,
    };
}

export async function walletSetup(
    _owner?: Address,
    _recoveryOwners?: Address[],
    _guardians?: Address[],
    ownerSignature?: string,
    saltNumber?: BigNumberish,
    _ownerSigner?: Wallet
): Promise<ReturnWalletSetup> {
    // deployments.fixture() needs to be called prior to the execution of this function.
    const _singleton = await deployments.get("LaserWallet");
    const abi = _singleton.abi;
    const singleton = (await ethers.getContractAt(abi, _singleton.address)) as LaserWallet;

    const _factory = await deployments.get("LaserFactory");
    const factory = await ethers.getContractAt(_factory.abi, _factory.address);

    let { owner, recoveryOwners, guardians } = await addressesForTest();
    let { ownerSigner } = await signersForTest();

    const chainId = (await ethers.provider.getNetwork()).chainId;

    owner = _owner ? _owner : owner;
    recoveryOwners = _recoveryOwners ? _recoveryOwners : recoveryOwners;
    guardians = _guardians ? _guardians : guardians;

    const salt = saltNumber ? saltNumber : 1111;

    const dataHash = ethers.utils.solidityKeccak256(
        ["address[]", "address[]", "uint256"],
        [guardians, recoveryOwners, chainId]
    );

    const signature = ownerSignature ? ownerSignature : await sign(_ownerSigner ? _ownerSigner : ownerSigner, dataHash);

    const initializer = getInitializer(owner, guardians, recoveryOwners, signature);

    const transaction = await factory.createProxy(initializer, salt);

    const receipt = await transaction.wait();
    const proxyAddress = receipt.events[0].args.laser;
    const wallet = (await ethers.getContractAt(abi, proxyAddress)) as LaserWallet;

    return {
        address: proxyAddress,
        wallet: wallet,
        factoryAddress: factory.address,
        factory: factory,
    };
}
