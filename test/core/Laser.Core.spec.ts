import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract } from "ethers";
import { walletSetup, addressesForTest, AddressesForTest, signersForTest } from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Core", () => {
    let addresses: AddressesForTest;
    let factory: Contract;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("init()", async () => {
        it("should not allow to call init after initialization", async () => {
            const { wallet } = await walletSetup();
            const random = ethers.Wallet.createRandom().address;
            const { recoveryOwners, guardians } = addresses;
            await expect(wallet.init(random, recoveryOwners, guardians, 0, 0, 0, addrZero, "0x")).to.be.revertedWith(
                "SSR__initOwner__walletInitialized()"
            );
        });

        it("should revert if we provide an address with code for the owner", async () => {
            const Caller = await ethers.getContractFactory("Caller");
            const caller = await Caller.deploy();
            await expect(walletSetup(caller.address)).to.be.reverted;
        });

        it("should revert if we provide address0 for the owner", async () => {
            const { recoveryOwners, guardians } = addresses;
            await expect(walletSetup(addrZero, recoveryOwners, guardians)).to.be.reverted;
        });

        it("should revert if we provide 1 recovery owner", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            await expect(walletSetup(owner, [recoveryOwners[0]], guardians)).to.be.reverted;
        });

        it("should revert if recovery owner is a contract that doesn't support 1271", async () => {
            const factory = await ethers.getContractFactory("Caller");
            const contract = await factory.deploy();
            const { owner, recoveryOwners, guardians } = addresses;
            const recoveryOwner2 = recoveryOwners[0]; // correct address;
            const invalid = [contract.address, recoveryOwner2];
            await expect(walletSetup(owner, invalid, guardians)).to.be.reverted;
        });

        it("should revert if we provide address 0 as a recovery owner", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            recoveryOwners[0] = addrZero;
            await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
        });

        it("should revert if the recovery owner is also a guardian", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            recoveryOwners[0] = guardians[0];
            await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
        });

        it("should revert if we provide the owner as the recovery owner", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            recoveryOwners[0] = owner;
            await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
        });

        it("should revert if we provide 1 guardian", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            await expect(walletSetup(owner, recoveryOwners, [guardians[0]])).to.be.reverted;
        });

        it("should revert if the guardian is a contract and doesn't support 1271", async () => {
            const factory = await ethers.getContractFactory("Caller");
            const contract = await factory.deploy();
            const { owner, recoveryOwners, guardians } = addresses;
            const guardian2 = guardians[0]; // correct address;
            const invalid = [contract.address, guardian2];
            await expect(walletSetup(owner, recoveryOwners, invalid)).to.be.reverted;
        });

        it("should revert if we provide the owner as a guardian", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            guardians[0] = owner;
            await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
        });

        it("should revert if we provide address 0 as a guardian", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            guardians[0] = addrZero;
            await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
        });

        it("should revert if there are duplicate guardians", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            guardians[guardians.length - 1] = guardians[0];
            await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
        });

        it("should correctly init with EOA's as recovery owners and guardians", async () => {
            // we will generate random key pairs.
            let owner = "";
            let ownerSigner;
            let recoveryOwners = [];
            let guardians = [];
            const amountOfSigners = 8;
            for (let i = 0; i < amountOfSigners; i++) {
                const randomSigner = ethers.Wallet.createRandom();
                if (i === 1) {
                    ownerSigner = randomSigner;
                    owner = ownerSigner.address;
                } else if (i > 1 && i < 5) recoveryOwners.push(randomSigner.address);
                else guardians.push(randomSigner.address);
            }
            const { wallet } = await walletSetup(
                owner,
                recoveryOwners,
                guardians,
                0,
                0,
                0,
                undefined,
                undefined,
                ownerSigner
            );
            expect(await wallet.owner()).to.equal(owner);
            const outputROwners = await wallet.getRecoveryOwners();
            for (let i = 0; i < outputROwners.length; i++) {
                const recoveryOwnerA = outputROwners[i];
                const recoveryOwnerB = recoveryOwners[i];
                expect(recoveryOwnerA).to.equal(recoveryOwnerB);
            }
            const outputGuardians = await wallet.getGuardians();
            for (let i = 0; i < outputGuardians.length; i++) {
                const guardianA = outputGuardians[i];
                const guardianB = guardians[i];
                expect(guardianA).to.equal(guardianB);
            }
        });

        it("should correctly init with with an EIP 1271 compliant recovery owner and guardian", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            const factory1 = await ethers.getContractFactory("LaserWallet");
            const contract1 = await factory1.deploy();
            const factory2 = await ethers.getContractFactory("LaserWallet");
            const contract2 = await factory1.deploy();
            const ownerSigner = ethers.Wallet.createRandom();
            const ownerAddress = ownerSigner.address;
            const rOwners = [contract1.address, recoveryOwners[0]]; // recovery owners
            let gs = [contract2.address, guardians[0]]; // guardians
            const { address, wallet } = await walletSetup(
                ownerAddress,
                rOwners,
                gs,
                0,
                0,
                0,
                undefined,
                undefined,
                ownerSigner
            );
            expect(await wallet.owner()).to.equal(ownerAddress);
            const outputROwners = await wallet.getRecoveryOwners();
            const outputGuardians = await wallet.getGuardians();

            for (let i = 0; i < 2; i++) {
                const guardianA = outputGuardians[i];
                const guardianB = gs[i];
                expect(guardianA).to.equal(guardianB);
                const recoveryOwnerA = outputROwners[i];
                const recoveryOwnerB = rOwners[i];
                expect(recoveryOwnerA).to.equal(recoveryOwnerB);
            }
        });

        it("should init and emit event", async () => {
            const { owner, recoveryOwners, guardians } = addresses;
            expect(await walletSetup(owner, recoveryOwners, guardians))
                .to.emit(abi, "Setup")
                .withArgs([owner, recoveryOwners, guardians]);
        });
    });
});
