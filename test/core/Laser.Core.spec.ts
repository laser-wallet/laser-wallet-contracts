import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Wallet } from "ethers";
import { walletSetup } from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";

const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Core", () => {
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

    describe("init()", async () => {
        it("should not allow to call init after initialization", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const random = ethers.Wallet.createRandom().address;
            await expect(
                wallet.init(random, recoveryOwners, guardians)
            ).to.be.revertedWith("Owner__initOwner__walletInitialized(");
        });

        it("should revert if we provide an address with code for the owner", async () => {
            const factory = await ethers.getContractFactory("LaserWallet");
            const contract = await factory.deploy();

            await expect(
                walletSetup(contract.address, recoveryOwners, guardians)
            ).to.be.reverted;
        });

        it("should revert if we provide address0 for the owner", async () => {
            await expect(walletSetup(addrZero, recoveryOwners, guardians)).to.be
                .reverted;
        });

        it("should revert if we provide 1 recovery owner", async () => {
            await expect(
                walletSetup(ownerAddress, [recoveryOwners[0]], guardians)
            ).to.be.reverted;
        });

        it("should revert if recovery owner is a contract that doesn't support 1271", async () => {
            const factory = await ethers.getContractFactory("Caller");
            const contract = await factory.deploy();
            const recoveryOwner2 = recoveryOwners[0]; // correct address;
            const invalid = [contract.address, recoveryOwner2];
            await expect(walletSetup(ownerAddress, invalid, guardians)).to.be
                .reverted;
        });

        it("should revert if we provide address 0 as a recovery owner", async () => {
            recoveryOwners[0] = addrZero;
            await expect(walletSetup(ownerAddress, recoveryOwners, guardians))
                .to.be.reverted;
        });

        it("should revert if the recovery owner is also a guardian", async () => {
            recoveryOwners[0] = guardians[0];
            await expect(walletSetup(ownerAddress, recoveryOwners, guardians))
                .to.be.reverted;
        });

        it("should revert if we provide the owner as the recovery owner", async () => {
            recoveryOwners[0] = ownerAddress;
            await expect(walletSetup(ownerAddress, recoveryOwners, guardians))
                .to.be.reverted;
        });

        it("should revert if we provide 1 guardian", async () => {
            await expect(
                walletSetup(ownerAddress, recoveryOwners, [guardians[0]])
            ).to.be.reverted;
        });

        it("should revert if the guardian is a contract and doesn't support 1271", async () => {
            const factory = await ethers.getContractFactory("Caller");
            const contract = await factory.deploy();
            const guardian2 = guardians[0]; // correct address;
            const invalid = [contract.address, guardian2];
            await expect(walletSetup(ownerAddress, recoveryOwners, invalid)).to
                .be.reverted;
        });

        it("should revert if we provide the owner as a guardian", async () => {
            guardians[0] = ownerAddress;
            await expect(walletSetup(ownerAddress, recoveryOwners, guardians))
                .to.be.reverted;
        });

        it("should revert if we provide address 0 as a guardian", async () => {
            guardians[0] = addrZero;
            await expect(walletSetup(ownerAddress, recoveryOwners, guardians))
                .to.be.reverted;
        });

        it("should revert if there are duplicate guardians", async () => {
            guardians[guardians.length - 1] = guardians[0];
            await expect(walletSetup(ownerAddress, recoveryOwners, guardians))
                .to.be.reverted;
        });

        it("should correctly init with EOA's as recovery owners and guardians", async () => {
            // we will generate random key pairs.
            let o = ""; // owner
            let rOwners = []; // recovery owners
            let gs = []; // guardians
            const amountOfSigners = 8;
            for (let i = 0; i < amountOfSigners; i++) {
                const randomSigner = ethers.Wallet.createRandom().address;
                if (i === 1) o = randomSigner;
                else if (i > 1 && i < 5) rOwners.push(randomSigner);
                else gs.push(randomSigner);
            }
            const { address, wallet } = await walletSetup(o, rOwners, gs);
            expect(await wallet.owner()).to.equal(o);

            const outputROwners = await wallet.getRecoveryOwners();
            for (let i = 0; i < outputROwners.length; i++) {
                const recoveryOwnerA = outputROwners[i].recoveryOwner;
                const recoveryOwnerB = rOwners[i];
                expect(recoveryOwnerA).to.equal(recoveryOwnerB);
            }

            const outputGuardians = await wallet.getGuardians();
            for (let i = 0; i < outputGuardians.length; i++) {
                const guardianA = outputGuardians[i];
                const guardianB = gs[i];
                expect(guardianA).to.equal(guardianB);
            }
        });

        it("should correctly init with with an EIP 1271 compliant recovery owner and guardian", async () => {
            const factory1 = await ethers.getContractFactory("LaserWallet");
            const contract1 = await factory1.deploy();
            const factory2 = await ethers.getContractFactory("LaserWallet");
            const contract2 = await factory1.deploy();
            let o = ethers.Wallet.createRandom().address;
            const rOwners = [contract1.address, recoveryOwners[0]]; // recovery owners
            let gs = [contract2.address, guardians[0]]; // guardians

            const { address, wallet } = await walletSetup(o, rOwners, gs);
            expect(await wallet.owner()).to.equal(o);

            const outputROwners = await wallet.getRecoveryOwners();
            const outputGuardians = await wallet.getGuardians();
            for (let i = 0; i < 2; i++) {
                const guardianA = outputGuardians[i];
                const guardianB = gs[i];
                expect(guardianA).to.equal(guardianB);
                const recoveryOwnerA = outputROwners[i].recoveryOwner;
                const recoveryOwnerB = rOwners[i];
                expect(recoveryOwnerA).to.equal(recoveryOwnerB);
            }
        });

        it("should init and emit event", async () => {
            expect(await walletSetup(ownerAddress, recoveryOwners, guardians))
                .to.emit(abi, "Setup")
                .withArgs([ownerAddress, recoveryOwners, guardians]);
        });
    });

    describe("exec()", () => {});

    
});
