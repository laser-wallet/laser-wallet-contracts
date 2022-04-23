import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import {
    encodeFunctionData,
    addressZero,
    SENTINEL,
    specialOwner,
    owner1,
    owner2,
    owner3,
    factorySetup,
    safeTx,
    execTx
} from "../utils";
import { SafeTx } from "../types";

const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Laser Wallet setup", () => {
    let relayer: Signer;
    let internalTx: SafeTx;
    let randy: Signer;
    let randyAddress: string;
    let singletonAddress: string;
    let entryPointAddress: string;

    beforeEach(async () => {
        [relayer] = await ethers.getSigners();
        internalTx = safeTx;
        randy = ethers.Wallet.createRandom();
        randyAddress = await randy.getAddress();
        const factorySingleton = await ethers.getContractFactory("LaserWallet");
        const singleton = await factorySingleton.deploy();
        singletonAddress = singleton.address;
        const ENTRY_POINT = await ethers.getContractFactory("TestEntryPoint");
        const entryPoint = await ENTRY_POINT.deploy(SENTINEL, 0, 0);
        entryPointAddress = entryPoint.address;
    });

    describe("Setup", () => {
        it("should not allow to setup with 0 address as an owner", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [addressZero];
            const specialOwners = [addressZero];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should not allow to setup with sentinel as an owner", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [SENTINEL];
            const specialOwners = [SENTINEL];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should not allow to setup with  duplicate owners", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address, owner1.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should not allow to setup without owners", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners: string[] = [];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should not allow to setup with duplicate special owners", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner1.address, owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should not allow to setup if a special owner is not on the owners[] array", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner3.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should not allow to setup if the threshold is 0", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                0,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should not allow to setup if the threshold is greater than the owner's length", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                3,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should revert if setup is called once created", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            const transaction = await factory.createProxyWithNonce(
                initializer,
                1111
            );
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, relayer);
            await expect(
                wallet.setup(owners, specialOwners, 1, SENTINEL, 0)
            ).to.be.revertedWith("OM: Wallet already initialized");
        });

        it("should allow to setup with same owners and special owners", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner1.address, owner2.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            const transaction = await factory.createProxyWithNonce(
                initializer,
                1111
            );
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, relayer);
            for (let i = 0; i < owners.length; i++) {
                const owner = owners[i];
                const specialOwner = specialOwners[i];
                expect(await wallet.isOwner(owner)).to.equal(true);
                expect(await wallet.isSpecialOwner(specialOwner)).to.equal(
                    true
                );
            }
        });

        it("should have correct information (owners & threshold) after setup", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [
                owner1.address,
                owner2.address,
                owner3.address,
                specialOwner.address
            ];
            const specialOwners = [owner1.address, specialOwner.address];
            const threshold = 3;
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                threshold,
                entryPointAddress,
                0
            ]);
            const transaction = await factory.createProxyWithNonce(
                initializer,
                1111
            );
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, relayer);
            expect(await wallet.getThreshold()).to.equal(threshold);
            const _owners = await wallet.getOwners();
            expect(_owners.length).to.equal(owners.length);
            const _specialOwners = await wallet.getSpecialOwners();
            expect(_specialOwners.length).to.equal(specialOwners.length);
            for (let i = 0; i < owners.length; i++) {
                const owner = owners[i];
                expect(await wallet.isOwner(owner)).to.equal(true);
            }
            for (let i = 0; i < specialOwners.length; i++) {
                const specialOwner = specialOwners[i];
                expect(await wallet.isSpecialOwner(specialOwner)).to.equal(
                    true
                );
            }
        });

        it("should have the correct singleton address at storage slot 0", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [
                owner1.address,
                owner2.address,
                owner3.address,
                specialOwner.address
            ];
            const specialOwners = [owner1.address, specialOwner.address];
            const threshold = 3;
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                threshold,
                entryPointAddress,
                0
            ]);
            const transaction = await factory.createProxyWithNonce(
                initializer,
                1111
            );
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, relayer);
            const _targetAddress = await ethers.provider.getStorageAt(
                wallet.address,
                0
            );
            // paded
            const targetAddress = `0x${_targetAddress.slice(26)}`;
            expect(targetAddress.toLowerCase()).to.equal(
                singletonAddress.toLowerCase()
            );
        });

        it("should not allow to setup with 0 address as entry point", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                addressZero,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

        it("should not allow to setup if there are more special owners than owners", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const owners = [owner1.address];
            const specialOwners = [owner1.address, owner2.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });

         it("should not allow to setup if an owner is a contract account", async () => {
            const { address, factory } = await factorySetup(singletonAddress);
            const cFactory = await ethers.getContractFactory("Caller");
            const owner = await cFactory.deploy();
            const owners = [owner.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [
                owners,
                specialOwners,
                1,
                entryPointAddress,
                0
            ]);
            await expect(factory.createProxyWithNonce(initializer, 1111)).to.be
                .reverted;
        });
    });
});
