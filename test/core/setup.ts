import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import { encodeFunctionData, addressZero, SENTINEL, signMessage, fakeSignature, paddedSignature} from "../utils";
import { Domain, types, TxMessage, SafeTx } from "../types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Laser Wallet setup", () => {
    let owner1: Wallet;
    let owner2: Wallet;
    let owner3: Wallet;
    let owner4: Wallet;
    let proxyFactory: Contract;
    let signature: string;
    let safeTx: SafeTx;
    let singleton: Contract;
    let salt: number;
    let signer: Signer;

    beforeEach(async () => {
        owner1 = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        owner2 = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        owner3 = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
        owner4 = new ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
        const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
        proxyFactory = await ProxyFactory.deploy();
        const LaserWallet = await ethers.getContractFactory("LaserWallet");
        singleton = await LaserWallet.deploy();
        salt = 1111;
        [signer] = await ethers.getSigners();
    });

    describe("singleton setup", () => {
        it("should not allow to call setup on the singleton (base contract)", async () => {
            const random = ethers.Wallet.createRandom();
            const _owners = [random.address];
            const _specialOwners = [random.address];
            await expect(singleton.setup(_owners, _specialOwners, 1, SENTINEL)).to.be.revertedWith("Wallet already initialized");
        });
    });

    describe("setup", () => {
        it("should not allow to setup with 0 address as an owner", async () => {
            const owners = [addressZero];
            const specialOwners = [addressZero];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should not allow to setup with sentinel as an owner", async () => {
            const owners = [SENTINEL];
            const specialOwners = [SENTINEL];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should not allow to setup with  duplicate owners", async () => {
            const owners = [owner1.address, owner1.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should not allow to setup without owners", async () => {
            const owners: string[] = [];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should not allow to setup with duplicate special owners", async () => {
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner1.address, owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should not allow to setup if a special owner is not on the owners[] array", async () => {
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner3.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should not allow to setup if the threshold is 0", async () => {
            const owners = [owner1.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 0, SENTINEL]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should not allow to setup if the threshold is greater than the owner's length", async () => {
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 3, SENTINEL]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should revert if setup is called once created", async () => {
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
            const transaction = await proxyFactory.createProxyWithNonce(singleton.address, initializer, salt);
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, signer);
            await expect(wallet.setup(owners, specialOwners, 1, SENTINEL)).to.be.revertedWith("Wallet already initialized");
        });
        it("should allow to setup with same owners and special owners", async () => {
            const owners = [owner1.address, owner2.address];
            const specialOwners = [owner1.address, owner2.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
            const transaction = await proxyFactory.createProxyWithNonce(singleton.address, initializer, salt);
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, signer);
            for (let i = 0; i<owners.length; i++) {
                const owner = owners[i];
                const specialOwner = specialOwners[i];
                expect(await wallet.isOwner(owner)).to.equal(true);
                expect(await wallet.isSpecialOwner(specialOwner)).to.equal(true);
            }
        });
        it("should have correct information (owners & threshold) after setup", async () => {
            const owners = [owner1.address, owner2.address, owner3.address, owner4.address];
            const specialOwners = [owner1.address, owner4.address];
            const threshold = 3;
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, threshold, SENTINEL]);
            const transaction = await proxyFactory.createProxyWithNonce(singleton.address, initializer, salt);
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, signer);
            expect(await wallet.getThreshold()).to.equal(threshold);
            const _owners = await wallet.getOwners();
            expect(_owners.length).to.equal(owners.length);
            const _specialOwners = await wallet.getSpecialOwners();
            expect(_specialOwners.length).to.equal(specialOwners.length);
            for (let i = 0; i<owners.length; i++) {
                const owner = owners[i];
                expect(await wallet.isOwner(owner)).to.equal(true);
            }
            for (let i = 0; i<specialOwners.length; i++) {
                const specialOwner = specialOwners[i];
                expect(await wallet.isSpecialOwner(specialOwner)).to.equal(true);
            }
        });
        it("should have the correct singleton address at storage slot 0", async () => {
            const owners = [owner1.address, owner2.address, owner3.address, owner4.address];
            const specialOwners = [owner1.address, owner4.address];
            const threshold = 3;
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, threshold, SENTINEL]);
            const transaction = await proxyFactory.createProxyWithNonce(singleton.address, initializer, salt);
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, signer);
            const _targetAddress = await ethers.provider.getStorageAt(wallet.address, 0);
            // paded
            const targetAddress = `0x${_targetAddress.slice(26)}`;
            expect(targetAddress.toLowerCase()).to.equal(singleton.address.toLowerCase());
        });
        it("should have the sentinel as the entry point at storage slot 1", async () => {
            const owners = [owner1.address, owner2.address, owner3.address, owner4.address];
            const specialOwners = [owner1.address, owner4.address];
            const threshold = 3;
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, threshold, SENTINEL]);
            const transaction = await proxyFactory.createProxyWithNonce(singleton.address, initializer, salt);
            const receipt = await transaction.wait();
            const walletAddress = receipt.events[1].args.proxy;
            const wallet = new ethers.Contract(walletAddress, abi, signer);
            const _targetAddress = await ethers.provider.getStorageAt(wallet.address, 1);
            const targetAddress = `0x${_targetAddress.slice(26)}`;
            expect(targetAddress).to.equal(SENTINEL);
        });
        it("should not allow to setup with 0 address as entry point", async () => {
            const owners = [owner1.address];
            const specialOwners = [owner1.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, addressZero]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
        it("should not allow to setup if there are more special owners than owners", async () => {
            const owners = [owner1.address];
            const specialOwners = [owner1.address, owner2.address];
            const initializer = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, addressZero]);
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.reverted;
        });
    });
});

