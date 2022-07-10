import { expect } from "chai";
import { ethers, deployments, getNamedAccounts } from "hardhat";
import { LaserProxyFactory } from "../../typechain-types";
import { Signer } from "ethers";
import {
    walletSetup,
    encodeFunctionData,
    getHash,
    generateTransaction,
    addressesForTest,
    AddressesForTest,
    signersForTest,
    sendTx,
} from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";
import { fundWallet } from "../utils";
import { sign } from "../utils/sign";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Owner", () => {
    let addresses: AddressesForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("Owner", async () => {
        it("should have the correct owner", async () => {
            const { address, wallet } = await walletSetup();
            const { owner } = addresses;
            expect(await wallet.owner()).to.equal(owner);
        });

        it("should not allow to init with address0", async () => {
            const { factory } = await walletSetup();
            const { recoveryOwners, guardians, relayer } = addresses;
            const initializer = encodeFunctionData(abi, "init", [
                addrZero,
                recoveryOwners,
                guardians,
                0,
                0,
                0,
                relayer,
                "0x",
            ]);
            await expect(factory.createProxy(initializer)).to.be.reverted;
        });

        it("should not allow to init with address with code", async () => {
            const { address, factory } = await walletSetup();
            const { recoveryOwners, guardians, relayer } = addresses;
            const initializer = encodeFunctionData(abi, "init", [
                address,
                recoveryOwners,
                guardians,
                0,
                0,
                0,
                relayer,
                "0x",
            ]);
            await expect(factory.createProxy(initializer)).to.be.reverted;
        });

        it("should revert by changing the owner to address0", async () => {
            const { address, wallet } = await walletSetup();
            const tx = await generateTransaction();
            tx.callData = encodeFunctionData(abi, "changeOwner", [addrZero]);
            tx.to = address;
            const hash = await getHash(wallet, tx);
            const { ownerSigner } = await signersForTest();
            tx.signatures = await sign(ownerSigner, hash);

            await expect(sendTx(wallet, tx)).to.be.reverted;
        });

        it("should revert by changing the owner to an address with code", async () => {
            const { address, wallet } = await walletSetup();
            const Caller = await ethers.getContractFactory("Caller");
            const caller = await Caller.deploy();
            const tx = await generateTransaction();
            tx.callData = encodeFunctionData(abi, "changeOwner", [caller.address]);
            tx.to = address;
            const hash = await getHash(wallet, tx);
            const { ownerSigner } = await signersForTest();
            tx.signatures = await sign(ownerSigner, hash);
            await expect(sendTx(wallet, tx)).to.be.reverted;
        });

        it("should change the owner", async () => {
            const { address, wallet } = await walletSetup();
            const newOwner = ethers.Wallet.createRandom().address;
            const tx = await generateTransaction();
            tx.callData = encodeFunctionData(abi, "changeOwner", [newOwner]);
            tx.to = address;
            const { ownerSigner } = await signersForTest();
            const hash = await getHash(wallet, tx);
            tx.signatures = await sign(ownerSigner, hash);
            await fundWallet(ownerSigner, address);
            await sendTx(wallet, tx);
            expect(await wallet.owner()).to.equal(newOwner);
        });

        it("should change the owner and emit event", async () => {});
    });

    describe("Recovery owner", () => {});
});
