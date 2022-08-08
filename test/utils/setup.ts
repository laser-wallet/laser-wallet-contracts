import { BigNumberish, Contract, Signer } from "ethers";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { encodeFunctionData } from "./utils";
import { sign } from "./sign";
import { Address } from "../types";
import { LaserWallet } from "../../typechain-types";
import { LaserFactory } from "../../typechain-types";
import { addrZero, ownerWallet } from "../constants/constants";

require("dotenv").config();

type ReturnWalletSetup = {
    address: Address;
    wallet: LaserWallet;
    factoryAddress: Address;
    factory: Contract;
    SSR: Address;
};

export type AddressesForTest = {
    owner: Address;
    recoveryOwners: Address[];
    guardians: Address[];
    relayer: Address;
};

export type SignersForTest = {
    ownerSigner: Signer;
    recoveryOwner1Signer: Signer;
    recoveryOwner2Signer: Signer;
    guardian1Signer: Signer;
    guardian2Signer: Signer;
    relayerSigner: Signer;
};

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

export async function initSSR(guardians: Address[], recoveryOwners: Address[]): Promise<string> {
    const abi = (await deployments.get("LaserModuleSSR")).abi;

    return encodeFunctionData(abi, "initSSR", [guardians, recoveryOwners]);
}

async function authorizeModule(modules: Address[]): Promise<void> {
    const abi = ["function approveModule(address module) external"];

    const [deployer] = await ethers.getSigners();

    const _laserRegistry = await deployments.get("LaserRegistry");

    const laserRegistry = await ethers.getContractAt(_laserRegistry.abi, _laserRegistry.address);

    modules.map(async (module) => {
        await laserRegistry.approveModule(module);
    });
}

export async function walletSetup(
    _owner?: Address,
    _recoveryOwners?: Address[],
    _guardians?: Address[],
    _maxFeePerGas?: BigNumberish,
    _maxPriorityFeePerGas?: BigNumberish,
    _gasLimit?: BigNumberish,
    _relayer?: Address,
    ownerSignature?: string,
    _ownerSigner?: Signer,
    saltNumber?: BigNumberish,
    fundWallet?: boolean
): Promise<ReturnWalletSetup> {
    // deployments.fixture() needs to be called prior to the execution of this function.
    const _LaserWallet = await deployments.get("LaserWallet");
    const abi = _LaserWallet.abi;
    const singleton = (await ethers.getContractAt(abi, _LaserWallet.address)) as LaserWallet;

    const Factory = await deployments.get("LaserFactory");
    const factory = await ethers.getContractAt(Factory.abi, Factory.address);

    let { owner, recoveryOwners, guardians, relayer } = await addressesForTest();
    let { ownerSigner } = await signersForTest();

    const maxFeePerGas = _maxFeePerGas ? _maxFeePerGas : 0;
    const maxPriorityFeePerGas = _maxPriorityFeePerGas ? _maxPriorityFeePerGas : 0;
    const gasLimit = _gasLimit ? _gasLimit : 0;

    const abiCoder = new ethers.utils.AbiCoder();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const dataHash = ethers.utils.keccak256(
        abiCoder.encode(
            ["uint256", "uint256", "uint256", "uint256"],
            [maxFeePerGas, maxPriorityFeePerGas, gasLimit, chainId]
        )
    );
    owner = _owner ? _owner : owner;
    ownerSigner = _ownerSigner ? _ownerSigner : ownerSigner;
    recoveryOwners = _recoveryOwners ? _recoveryOwners : recoveryOwners;
    guardians = _guardians ? _guardians : guardians;
    relayer = _relayer ? _relayer : relayer;
    const salt = saltNumber ? saltNumber : 1111;

    const ssrInitData = initSSR(guardians, recoveryOwners);
    const LaserSSRModuleAddress = (await deployments.get("LaserModuleSSR")).address;
    const preComputedAddress = await factory.preComputeAddress(owner, LaserSSRModuleAddress, ssrInitData, salt);

    const laserVaultAddress = (await deployments.get("LaserVault")).address;

    if (fundWallet) {
        await ownerSigner.sendTransaction({
            to: preComputedAddress,
            value: ethers.utils.parseEther("10"),
        });
    }

    await authorizeModule([LaserSSRModuleAddress, laserVaultAddress]);

    const signature = ownerSignature ? ownerSignature : await sign(ownerSigner, dataHash);

    const transaction = await factory.deployProxyAndRefund(
        owner,
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit,
        relayer,
        LaserSSRModuleAddress,
        laserVaultAddress,
        ssrInitData,
        salt,
        signature,
        { gasLimit: gasLimit > 0 ? gasLimit : 10000000 }
    );

    const receipt = await transaction.wait();
    const proxyAddress = receipt.events[0].args.proxy;

    const wallet = (await ethers.getContractAt(abi, proxyAddress)) as LaserWallet;

    return {
        address: proxyAddress,
        wallet: wallet,
        factoryAddress: Factory.address,
        factory: factory,
        SSR: LaserSSRModuleAddress,
    };
}

export async function getRecoveryOwners(module: Address, wallet: Address): Promise<Address[]> {
    const abi = ["function getRecoveryOwners(address) external view returns (address[] memory)"];
    const contract = new ethers.Contract(module, abi, ethers.provider);
    return contract.getRecoveryOwners(wallet);
}

export async function getGuardians(module: Address, wallet: Address): Promise<Address[]> {
    const abi = ["function getGuardians(address) external view returns (address[] memory)"];
    const contract = new ethers.Contract(module, abi, ethers.provider);
    return contract.getGuardians(wallet);
}
