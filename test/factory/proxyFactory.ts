import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

import { encodeFunctionData, VERSION, addressZero, SENTINEL } from "../utils";
import { TransactionDescription } from "ethers/lib/utils";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Proxy Factory", () => {
    let owner1: Signer;
    let owner2: Signer;
    let owners: string[];
    let sender: Signer;
    let proxyFactory: Contract;
    let initializer: string;
    let singleton: Contract;
    let threshold: number;
    let salt: number;

    beforeEach(async () => {
        [ owner1, owner2 ] = await ethers.getSigners();
        const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
        const LaserWallet = await ethers.getContractFactory("LaserWallet");
        proxyFactory = await ProxyFactory.deploy();
        singleton = await LaserWallet.deploy();
        threshold = 1;
        owners = [await owner1.getAddress(), await owner2.getAddress()];
        const specialOwners: string[] = [];
        initializer = encodeFunctionData(abi, "setup", [owners,specialOwners, threshold, SENTINEL]);
        salt = 1111;
    });

    describe("createProxy", () => {
        it("should revert by giving address 0 as singleton", async () => {
            await expect(proxyFactory.createProxy(addressZero, "0x")).to.be.revertedWith("Invalid singleton address provided");
        });
        it("should emit event when creation", async () => {
            await expect(proxyFactory.createProxy(singleton.address, "0x")).to.emit(proxyFactory, "ProxyCreation");
        });
        it("should create correct proxy", async () => {
            const transaction = await proxyFactory.createProxy(singleton.address, initializer);
            const receipt = await transaction.wait();
            const proxyAddress = receipt.events[1].args.proxy;
            const proxy = new ethers.Contract(proxyAddress, abi, owner1);
            const _threshold = await proxy.getThreshold();
            expect(_threshold.toString()).to.equal(threshold.toString());
            for (let i = 0; i<owners.length; i++) {
                const owner = owners[i];
                expect(await proxy.isOwner(owner)).to.equal(true);
                expect(await proxy.isSpecialOwner(owner)).to.equal(false);
            }
        });
    });

    describe("createProxyWithNonce", () => {
        it("should revert by giving address 0 as singleton", async () => {
            await expect(proxyFactory.createProxyWithNonce(addressZero, "0x", salt)).to.be.revertedWith("Create2 call failed");
        });
        it("should emit event when creation", async () => {
            await expect(proxyFactory.createProxyWithNonce(singleton.address, "0x", salt)).to.emit(proxyFactory, "ProxyCreation");
        });
        it("should create correct proxy", async () => {
            const transaction = await proxyFactory.createProxyWithNonce(singleton.address, initializer, salt);
            const receipt = await transaction.wait();
            const proxyAddress = receipt.events[1].args.proxy;
            const proxy = new ethers.Contract(proxyAddress, abi, owner1);
            const _threshold = await proxy.getThreshold();
            expect(_threshold.toString()).to.equal(threshold.toString());
            for (let i = 0; i<owners.length; i++) {
                const owner = owners[i];
                expect(await proxy.isOwner(owner)).to.equal(true);
                expect(await proxy.isSpecialOwner(owner)).to.equal(false);
            }
        });
        it("should revert by creating a proxy with same salt", async () => {
            // tx 1
            await proxyFactory.createProxyWithNonce(singleton.address, initializer, salt);
            // tx 2
            await expect(proxyFactory.createProxyWithNonce(singleton.address, initializer, salt)).to.be.revertedWith("Create2 call failed");
        });
    });
});