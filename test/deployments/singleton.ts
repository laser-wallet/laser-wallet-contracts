import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

import { VERSION, addressZero, SENTINEL, encodeFunctionData, paddedSignature } from "../utils";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Laser Wallet (singleton) deployment", () => {
    let hacker: Signer;
    let LaserWallet: any;
    let singleton: Contract;
    let owners: string[];
    let specialOwners: string[];

    beforeEach(async () => {
        [hacker] = await ethers.getSigners();
        LaserWallet = await ethers.getContractFactory("LaserWallet");
        singleton = await LaserWallet.deploy();
        owners = [await hacker.getAddress()];
        specialOwners = [];
    });

    describe("Singleton correct deployemnent", () => {
        it("should deploy with a threshold of 1", async () => {
            const threshold = await singleton.getThreshold();
            expect(threshold.toString()).to.equal("1");
        });
        it("should not allow to setup", async () => {
            const entryPoint = SENTINEL;
            const threshold = 1;
            await expect(singleton.setup(
                owners,
                specialOwners,
                threshold,
                entryPoint
            )).to.be.revertedWith("'Wallet already initialized'");

        });
        it("should not have owners", async () => {
            await expect(singleton.getOwners()).to.be.revertedWith("0x32");
        });
        it(`should be version ${VERSION}`, async () => {
            const version = await singleton.VERSION();
            expect(version === VERSION);
        });
        it("should have a nonce of 0", async () => {
            const nonce = await singleton.nonce();
            expect(nonce.toString()).to.equal("0");
        });
        it("should not be able to make operations", async () => {
            await expect(singleton.changeThreshold(2)).to.be.revertedWith("Only callable from the wallet");
        });
        it("should not be able to execute a safe transaction", async () => {
            const data = encodeFunctionData(abi, "changeThreshold", [2]);
            const signature = paddedSignature(await hacker.getAddress());
            await expect(singleton.execTransaction(singleton.address, 0, data, 0, 0, 0, 0, addressZero, addressZero, signature, addressZero)
            ).to.be.revertedWith("Invalid owner provided");
        });
    });
});




