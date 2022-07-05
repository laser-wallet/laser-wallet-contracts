import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { Address } from "../types";
import {
    encodeFunctionData,
    walletSetup,
    addressesForTest,
    AddressesForTest,
} from "../utils";

describe("Proxy Factory", () => {
    let addresses: AddressesForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("Proxy Factory creation and interaction", () => {
        it("should have the singleton stored after deployment", async () => {
            const singleton = await deployments.get("LaserWallet");
            const { factory } = await walletSetup();
            expect(await factory.singleton()).to.equal(singleton.address);
        });

        it("should revert by providing an invalid singleton (EOA)", async () => {
            const randy = ethers.Wallet.createRandom();
            const Factory = await ethers.getContractFactory(
                "LaserProxyFactory"
            );
            await expect(Factory.deploy(randy.address)).to.be.reverted;
        });

        it("should revert by providing an invalid singleton (contract)", async () => {
            const Caller = await ethers.getContractFactory("Caller");
            const caller = await Caller.deploy();
            const Factory = await ethers.getContractFactory(
                "LaserProxyFactory"
            );
            await expect(Factory.deploy(caller.address)).to.be.reverted;
        });

        it("should deploy a proxy with 'createProxy'", async () => {
            const { factory, initializer } = await walletSetup();
            await expect(factory.createProxy(initializer)).to.emit(
                factory,
                "ProxyCreation"
            );
        });

        it("should precompute the proxy address with 'create'", async () => {
            const { factory, initializer } = await walletSetup();
            const factoryNonce = await ethers.provider.getTransactionCount(
                factory.address
            );
            // Precompute the address.
            const from = factory.address;
            const nonce = factoryNonce;
            const precompute = ethers.utils.getContractAddress({
                from: from,
                nonce: nonce,
            });

            const tx = await factory.createProxy(initializer);
            const receipt = await tx.wait();
            const proxy = receipt.events[1].args.proxy;

            expect(precompute).to.equal(proxy);
        });

        it("should deploy a proxy with 'createProxyWithNonce'", async () => {
            const { factory, initializer } = await walletSetup();
            await expect(factory.createProxyWithNonce(initializer, 1)).to.emit(
                factory,
                "ProxyCreation"
            );
        });

        it("should precompute the proxy address with create2", async () => {
            const { factory, initializer } = await walletSetup();
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
            const { factory, initializer } = await walletSetup();
            const salt = 1;
            await factory.createProxyWithNonce(initializer, salt); // first deployment.
            await expect(factory.createProxyWithNonce(initializer, salt)).to.be
                .reverted; // second deployment.
        });
    });
});
