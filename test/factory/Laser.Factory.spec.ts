import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
    walletSetup,
    addressesForTest,
    AddressesForTest,
    signersForTest,
    SignersForTest,
    sign,
    getInitializer,
} from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";

describe("Proxy Factory", () => {
    let addresses: AddressesForTest;
    let signers: SignersForTest;
    let chainId: number;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        signers = await signersForTest();
        const network = await ethers.provider.getNetwork();
        chainId = network.chainId;
    });

    describe("Proxy Factory creation and interaction", () => {
        it("should have the singleton stored after deployment", async () => {
            const singleton = await deployments.get("LaserWallet");
            const { factory } = await walletSetup();
            expect(await factory.singleton()).to.equal(singleton.address);
        });

        it("should revert by providing an invalid singleton (EOA)", async () => {
            const random = ethers.Wallet.createRandom();
            const factory = await ethers.getContractFactory("LaserFactory");
            await expect(factory.deploy(random.address)).to.be.reverted;
        });

        it("should revert by providing an invalid singleton (contract)", async () => {
            const Caller = await ethers.getContractFactory("Caller");
            const caller = await Caller.deploy();
            const factory = await ethers.getContractFactory("LaserFactory");
            await expect(factory.deploy(caller.address)).to.be.reverted;
        });

        it("should revert if the owner signs with an invalid chain id", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            const invalidChainId = 1234;
            const dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, recoveryOwners, invalidChainId]
            );
            const signature = await sign(ownerSigner, dataHash);
            const initializer = getInitializer(owner, guardians, recoveryOwners, signature);

            await expect(factory.createProxy(initializer, saltNumber)).to.be.reverted;
        });

        it("should deploy a proxy with 'createProxy()' create2", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            const dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, recoveryOwners, chainId]
            );
            const signature = await sign(ownerSigner, dataHash);
            const initializer = getInitializer(owner, guardians, recoveryOwners, signature);

            await expect(factory.createProxy(initializer, saltNumber)).to.emit(factory, "LaserCreated");
        });

        it("should precompute the proxy address 'precomputeAddress()'", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            const dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, recoveryOwners, chainId]
            );
            const signature = await sign(ownerSigner, dataHash);
            const initializer = getInitializer(owner, guardians, recoveryOwners, signature);

            const tx = await factory.createProxy(initializer, saltNumber);
            const receipt = await tx.wait();
            const address = receipt.events[0].args.laser;

            const preComputedAddress = await factory.preComputeAddress(initializer, saltNumber);

            expect(address).to.equal(preComputedAddress);
        });

        it("should return a different address if we change the salt", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            const dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, recoveryOwners, chainId]
            );
            const signature = await sign(ownerSigner, dataHash);
            const initializer = getInitializer(owner, guardians, recoveryOwners, signature);

            const tx = await factory.createProxy(initializer, saltNumber);
            const receipt = await tx.wait();
            const address = receipt.events[0].args.laser;

            const preComputedAddress = await factory.preComputeAddress(initializer, 123123);

            expect(address).to.not.equal(preComputedAddress);
        });

        it("should return a different address if we change the owner", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            const dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, recoveryOwners, chainId]
            );
            const signature = await sign(ownerSigner, dataHash);
            let initializer = getInitializer(owner, guardians, recoveryOwners, signature);

            const tx = await factory.createProxy(initializer, saltNumber);
            const receipt = await tx.wait();
            const address = receipt.events[0].args.laser;

            initializer = getInitializer(ethers.Wallet.createRandom().address, guardians, recoveryOwners, signature);
            const preComputedAddress = await factory.preComputeAddress(initializer, saltNumber);

            expect(address).to.not.equal(preComputedAddress);
        });

        it("should return a different address if we change a guardain", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            let dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, recoveryOwners, chainId]
            );
            let signature = await sign(ownerSigner, dataHash);
            let initializer = getInitializer(owner, guardians, recoveryOwners, signature);

            const tx = await factory.createProxy(initializer, saltNumber);
            const receipt = await tx.wait();
            const address = receipt.events[0].args.laser;

            dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [[ethers.Wallet.createRandom().address], recoveryOwners, chainId]
            );
            signature = await sign(ownerSigner, dataHash);
            initializer = getInitializer(owner, guardians, recoveryOwners, signature);
            const preComputedAddress = await factory.preComputeAddress(initializer, saltNumber);

            expect(address).to.not.equal(preComputedAddress);
        });

        it("should return a different address if we change a recovery owner", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            let dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, recoveryOwners, chainId]
            );
            let signature = await sign(ownerSigner, dataHash);
            let initializer = getInitializer(owner, guardians, recoveryOwners, signature);

            const tx = await factory.createProxy(initializer, saltNumber);
            const receipt = await tx.wait();
            const address = receipt.events[0].args.laser;

            dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, [ethers.Wallet.createRandom().address], chainId]
            );
            signature = await sign(ownerSigner, dataHash);
            initializer = getInitializer(owner, guardians, recoveryOwners, signature);
            const preComputedAddress = await factory.preComputeAddress(initializer, saltNumber);

            expect(address).to.not.equal(preComputedAddress);
        });

        it("should revert by deploying the same address twice", async () => {
            // When deploying a contract, the EVM checks if the address has code,
            // if it does, it reverts.
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            let dataHash = ethers.utils.solidityKeccak256(
                ["address[]", "address[]", "uint256"],
                [guardians, recoveryOwners, chainId]
            );
            let signature = await sign(ownerSigner, dataHash);
            let initializer = getInitializer(owner, guardians, recoveryOwners, signature);

            // first transaction
            await factory.createProxy(initializer, saltNumber);

            // second transaction
            await expect(factory.createProxy(initializer, saltNumber)).to.be.reverted;
        });
    });
});
