import { BigNumberish, Contract, Signer } from "ethers";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { encodeFunctionData } from "./utils";
import { Address } from "../types";
import { LaserWallet } from "../../typechain-types";
import { LaserProxyFactory } from "../../typechain-types";

interface ReturnWalletSetup {
    address: Address;
    wallet: LaserWallet;
    factoryAddress: Address;
    factory: Contract;
    initializer: string;
}

export interface AddressesForTest {
    owner: Address;
    recoveryOwners: Address[];
    guardians: Address[];
    relayer: Address;
}

export interface SignersForTest {
    ownerSigner: Signer;
    recoveryOwner1Signer: Signer;
    recoveryOwner2Signer: Signer;
    guardian1Signer: Signer;
    guardian2Signer: Signer;
    relayerSigner: Signer;
}

export async function addressesForTest(): Promise<AddressesForTest> {
    const [owner, recoveryOwner1, recoveryOwner2, guardian1, guardian2, relayer] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();

    const recoveryOwners = [await recoveryOwner1.getAddress(), await recoveryOwner2.getAddress()];

    const guardians = [await guardian1.getAddress(), await guardian2.getAddress()];

    const relayerAddress = await relayer.getAddress();
    return {
        owner: ownerAddress,
        recoveryOwners: recoveryOwners,
        guardians: guardians,
        relayer: relayerAddress,
    };
}

export async function signersForTest(): Promise<SignersForTest> {
    const [owner, recoveryOwner1, recoveryOwner2, guardian1, guardian2, relayer] = await ethers.getSigners();
    return {
        ownerSigner: owner,
        recoveryOwner1Signer: recoveryOwner1,
        recoveryOwner2Signer: recoveryOwner2,
        guardian1Signer: guardian1,
        guardian2Signer: guardian2,
        relayerSigner: relayer,
    };
}

export async function walletSetup(
    _owner?: Address,
    _recoveryOwners?: Address[],
    _guardians?: Address[]
): Promise<ReturnWalletSetup> {
    // deployments.fixture() needs to be called prior to the execution of this function.
    const _LaserWallet = await deployments.get("LaserWallet");
    const abi = _LaserWallet.abi;
    const singleton = (await ethers.getContractAt(abi, _LaserWallet.address)) as LaserWallet;
    const Factory = await deployments.get("LaserProxyFactory");
    const factory = await ethers.getContractAt(Factory.abi, Factory.address);

    const { owner, recoveryOwners, guardians } = await addressesForTest();

    const initializer = encodeFunctionData(abi, "init", [
        _owner ? _owner : owner,
        _recoveryOwners ? _recoveryOwners : recoveryOwners,
        _guardians ? _guardians : guardians,
    ]);
    const transaction = await factory.createProxy(initializer);
    const receipt = await transaction.wait();
    const proxyAddress = receipt.events[1].args.proxy;
    const wallet = (await ethers.getContractAt(abi, proxyAddress)) as LaserWallet;
    return {
        address: proxyAddress,
        wallet: wallet,
        factoryAddress: Factory.address,
        factory: factory,
        initializer: initializer,
    };
}
