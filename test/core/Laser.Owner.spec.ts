import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
    walletSetup,
    encodeFunctionData,
    factorySetup,
    getHash,
    generateTransaction,
    sendTx,
} from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";
import { fundWallet } from "../utils";
import { sign } from "../utils/sign";

const mock = ethers.Wallet.createRandom().address;
const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Owner", () => {
    let owner: Signer;
    let ownerAddress: Address;
    let recoveryOwner1: Signer;
    let recoveryOwner2: Signer;
    let guardians: Address[];
    let _guardian1: Signer;
    let _guardian2: Signer;
    let relayer: Signer;
    let recoveryOwners: Address[];

    beforeEach(async () => {
        [
            owner,
            recoveryOwner1,
            recoveryOwner2,
            _guardian1,
            _guardian2,
            relayer,
        ] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwners = [
            await recoveryOwner1.getAddress(),
            await recoveryOwner2.getAddress(),
        ];
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress(),
        ];
    });

    describe("Owner", async () => {
        it("should have the correct owner", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            expect(await wallet.owner()).to.equal(ownerAddress);
        });

        it("should not allow to init with address0", async () => {
            const LaserWallet = await ethers.getContractFactory("LaserWallet");
            const singleton = await LaserWallet.deploy();
            const singletonAddress = singleton.address;
            const { address, factory } = await factorySetup(singletonAddress);
            const initializer = encodeFunctionData(abi, "init", [
                addrZero,
                recoveryOwners,
                guardians,
            ]);
            await expect(factory.createProxy(initializer)).to.be.reverted;
        });

        it("should not allow to init with address with code", async () => {
            const LaserWallet = await ethers.getContractFactory("LaserWallet");
            const singleton = await LaserWallet.deploy();
            const singletonAddress = singleton.address;
            const { address, factory } = await factorySetup(singletonAddress);
            const initializer = encodeFunctionData(abi, "init", [
                address,
                recoveryOwners,
                guardians,
            ]);
            await expect(factory.createProxy(initializer)).to.be.reverted;
        });

        it("should revert by changing the owner to address0", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const tx = await generateTransaction();
            tx.callData = encodeFunctionData(abi, "changeOwner", [addrZero]);
            tx.to = address;
            const hash = await getHash(wallet, tx);
            tx.signatures = await sign(owner, hash);

            await expect(sendTx(wallet, tx)).to.be.reverted;
        });

        it("should revert by changing the owner to an address with code", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const cFactory = await ethers.getContractFactory("LaserWallet");
            const c = await cFactory.deploy();
            const tx = await generateTransaction();
            tx.callData = encodeFunctionData(abi, "changeOwner", [c.address]);
            tx.to = address;
            const hash = await getHash(wallet, tx);
            tx.signatures = await sign(owner, hash);
            await expect(sendTx(wallet, tx)).to.be.reverted;
        });

        it("should change the owner", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const newOwner = ethers.Wallet.createRandom().address;
            const tx = await generateTransaction();
            tx.callData = encodeFunctionData(abi, "changeOwner", [newOwner]);
            tx.to = address;
            const hash = await getHash(wallet, tx);
            tx.signatures = await sign(owner, hash);

            await fundWallet(owner, address);
            await sendTx(wallet, tx);
            expect(await wallet.owner()).to.equal(newOwner);
        });

        it("should change the owner and emit event", async () => {});
    });

    describe("Recovery owner", () => {});
});
