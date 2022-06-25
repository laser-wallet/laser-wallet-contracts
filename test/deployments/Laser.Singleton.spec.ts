import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

const mock = Wallet.createRandom().address;
const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

const VERSION = "1.0.0";

describe("Laser Wallet (singleton)", () => {
    let relayer: Signer;
    let singleton: Contract;

    beforeEach(async () => {
        [relayer] = await ethers.getSigners();
        const factorySingleton = await ethers.getContractFactory("LaserWallet");
        singleton = await factorySingleton.deploy();
    });

    describe("singleton correct deployment", async () => {
        it("should have its address as owner (so it becomes unusable)", async () => {
            const owner = await singleton.owner();
            expect(owner).to.equal(singleton.address);
        });

        it("should not allow to init", async () => {
            await expect(
                singleton.init(mock, mock, [mock])
            ).to.be.revertedWith("Owner__initOwner__walletInitialized()");
        });

        it(`should be version ${VERSION}`, async () => {
            const version = await singleton.VERSION();
            expect(version).to.equal(VERSION);
        });

        it("should have a nonce of 0", async () => {
            const nonce = await singleton.nonce();
            expect(nonce).to.equal(0);
        });

        it("should not be able to make operations", async () => {
            await expect(singleton.changeOwner(mock)).to.be.revertedWith(
                "SelfAuthorized__notWallet()"
            );
        });
    });
});
