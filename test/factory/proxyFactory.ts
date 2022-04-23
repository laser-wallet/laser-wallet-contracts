import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

import { encodeFunctionData, VERSION, addressZero, SENTINEL } from "../utils";
import { encode } from "punycode";

const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Proxy Factory", () => {
    let singleton: string;
    let _factory: any;
    let initializer: string;
    let owner: string;

    beforeEach(async () => {
        const singletonFactory = await ethers.getContractFactory("LaserWallet");
        const _singleton = await singletonFactory.deploy();
        singleton = _singleton.address;
        _factory = await ethers.getContractFactory("LaserProxyFactory");
        const [_owner] = await ethers.getSigners();
        owner = await _owner.getAddress();
        const factoryEntryPoint = await ethers.getContractFactory(
            "TestEntryPoint"
        );
        const entryPoint = await factoryEntryPoint.deploy(SENTINEL, 0, 0);
        initializer = encodeFunctionData(abi, "setup", [
            [owner],
            [],
            1,
            entryPoint.address,
            0
        ]);
    });

    describe("Proxy Factory creation and interaction", () => {
        it("should have the singleton stored after deployment", async () => {
            const factory = await _factory.deploy(singleton);
            expect(await factory.singleton()).to.equal(singleton);
        });

        it("should revert by providing an invalid singleton (EOA)", async () => {
            const randy = ethers.Wallet.createRandom();
            await expect(_factory.deploy(randy.address)).to.be.reverted;
        });

        it("should revert by providing an invalid singleton (contract)", async () => {
            const factoryTest = await ethers.getContractFactory("Caller");
            const test = await factoryTest.deploy();
            await expect(_factory.deploy(test.address)).to.be.reverted;
        });

        it("should deploy a proxy with 'createProxy'", async () => {
            const factory = await _factory.deploy(singleton);
            await expect(factory.createProxy(initializer)).to.emit(
                factory,
                "ProxyCreation"
            );
        });

        it("should precompute the proxy address with 'create'", async () => {
            const factory = await _factory.deploy(singleton);
            // Precompute the address.
            const from = factory.address;
            const nonce = 1;
            const precompute = ethers.utils.getContractAddress({
                from: from,
                nonce: nonce
            });

            const tx = await factory.createProxy(initializer);
            const receipt = await tx.wait();
            const proxy = receipt.events[1].args.proxy;

            expect(precompute).to.equal(proxy);
        });

        it("should deploy a proxy with 'createProxyWithNonce'", async () => {
            const factory = await _factory.deploy(singleton);
            await expect(factory.createProxyWithNonce(initializer, 1)).to.emit(
                factory,
                "ProxyCreation"
            );
        });

        it("should precompute the proxy address with create2", async () => {
            const factory = await _factory.deploy(singleton);
            // Precompute the address.
            const from = factory.address;
            const precompute = await factory.preComputeAddress(initializer, 1);

            const tx = await factory.createProxyWithNonce(initializer, 1);
            const receipt = await tx.wait();
            const proxy = receipt.events[1].args.proxy;

            expect(precompute).to.equal(proxy);
        });

        it("should revert by deploying the proxy with the same salt", async () => {
            // When deploying a contract, the EVM checks if the address has code,
            // if it does, it reverts.
            const factory = await _factory.deploy(singleton);
            const salt = 1;
            await factory.createProxyWithNonce(initializer, salt); //First deployment.
            await expect(factory.createProxyWithNonce(initializer, salt)).to.be
                .reverted; //Second deployment.
        });
    });
});
