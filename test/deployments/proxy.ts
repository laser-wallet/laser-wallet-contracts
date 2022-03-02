import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

import { encodeFunctionData, VERSION, addressZero, SENTINEL } from "../utils";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");
const singletonAbi = abi;

describe("proxy deployment", () => {
    let alice: Signer;
    let bob: Signer;
    let LaserWallet: any;
    let ProxyFactory: any;
    let proxyFactory: Contract;
    let singleton: Contract;
    let singletonAddress: string;
    let aliceAddress: string;
    let bobAddress: string;
    let owners: string[];
    let threshold: string | number;
    let data: string;

    beforeEach(async () => {
        [alice, bob] = await ethers.getSigners();
        LaserWallet = await ethers.getContractFactory("LaserWallet");
        ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
        proxyFactory = await ProxyFactory.deploy();
        singleton = await LaserWallet.deploy();
        singletonAddress = singleton.address;
        aliceAddress = await alice.getAddress();
        bobAddress = await bob.getAddress();
        owners = [aliceAddress, bobAddress];
        threshold = 2;
        const entryPoint = SENTINEL;
        const specialOwners: string[] = [];
        data = encodeFunctionData(singletonAbi, "setup", [owners, specialOwners, threshold, entryPoint]);
    });

    describe("Proxy contract correct deployment", () => {
        it("should create a proxy with createProxy()", async () => {
            await expect(proxyFactory.createProxy(singletonAddress, data)
            ).to.emit(proxyFactory, "ProxyCreation");
        });
        it("should create a proxy with createProxyWithNonce()", async () => {
            const saltNonce = 1111;
            await expect(proxyFactory.createProxyWithNonce(singletonAddress, data, saltNonce)
            ).to.emit(proxyFactory, "ProxyCreation");

        });
    });

    describe("Proxy creation and basic interaction", () => {
        let proxyAddress: string;
        let proxyContract: Contract;

        beforeEach(async () => {
            const txProxyDeployment = await proxyFactory.createProxyWithNonce(singletonAddress, data, 1111);
            const receipt = await txProxyDeployment.wait();
            proxyAddress = receipt.events[1].args.proxy;
            proxyContract = await ethers.getContractAt("LaserWallet", proxyAddress);
        });
        it("should have the correct singleton address", async () => {
            // singleton is stored at storage slot 0.
            const _targetAddress = await ethers.provider.getStorageAt(proxyContract.address, 0);
            // padded.
            const targetAddress = `0x${_targetAddress.slice(26)}`;
            expect(targetAddress.toLowerCase()).to.equal(singletonAddress.toLowerCase());
        });
        it("should match the address", async () => {
            expect(proxyContract.address).to.equal(proxyAddress);
        });
        it("should have a threshold of 2", async () => {
            const threshold = (await proxyContract.getThreshold()).toString();
            expect(threshold).to.equal("2");
        });
        it("should have alice and bob as unique owners", async () => {
            const _owners = await proxyContract.getOwners();
            expect(_owners.length).to.equal(2);
            expect(await proxyContract.isOwner(aliceAddress)).to.equal(true);
            expect(await proxyContract.isOwner(bobAddress)).to.equal(true);
        });
        it(`should be version ${VERSION}`, async () => {
            const _version = await proxyContract.VERSION();
            expect(_version).to.equal(VERSION);
        });
    });
});





