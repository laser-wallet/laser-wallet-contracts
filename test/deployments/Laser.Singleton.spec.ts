import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import { LaserWallet } from "../../typechain-types";
import { addrZero } from "../constants/constants";

const mock = Wallet.createRandom().address;

const VERSION = "1.0.0";

describe("Laser Wallet (singleton)", () => {
    let singleton: Contract;

    beforeEach(async () => {
        await deployments.fixture(["LaserWallet"]);
        const Singleton = await deployments.get("LaserWallet");
        singleton = await ethers.getContractAt(Singleton.abi, Singleton.address);
    });

    describe("singleton correct deployment", async () => {
        it("should have its address as owner (so it becomes unusable)", async () => {
            const owner = await singleton.owner();
            expect(owner).to.equal(singleton.address);
        });

        it("should not allow to init", async () => {
            await expect(singleton.init(mock, [mock], [mock], "0x")).to.be.revertedWith(
                "LS__initOwner__walletInitialized()"
            );
        });

        it(`should be version ${VERSION}`, async () => {
            const version = await singleton.VERSION();
            expect(version).to.equal(VERSION);
        });

        it("should have a nonce of 0", async () => {
            const nonce = await singleton.nonce();
            expect(nonce).to.equal(0);
        });
    });
});
