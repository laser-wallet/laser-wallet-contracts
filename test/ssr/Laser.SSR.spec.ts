import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
    walletSetup,
    sign,
    signTypedData,
    generateTransaction,
    addressesForTest,
    signersForTest,
    AddressesForTest,
    encodeFunctionData,
    getHash,
    sendTx,
} from "../utils";
import { Address, Domain } from "../types";
import { addrZero, ownerWallet } from "../constants/constants";

const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Sovereign Social Recovery", () => {
    let addresses: AddressesForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("Owner", () => {
        describe("init()", () => {
            it("should fail by providing address 0", async () => {
                await expect(walletSetup(addrZero)).to.be.reverted;
            });

            it("should fail by providing an address with code", async () => {
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                await expect(walletSetup(caller.address)).to.be.reverted;
            });

            it("should fail if we try to init after initialization", async () => {
                const { address, wallet } = await walletSetup();
                const { owner, recoveryOwners, guardians } = addresses;
                await expect(
                    wallet.init(owner, recoveryOwners, guardians)
                ).to.be.revertedWith("'Owner__initOwner__walletInitialized()'");
            });
        });
    });

    describe("Recovery Owners", () => {
        describe("init()", () => {
            it("should fail by providing one recovery owner", async () => {
                const { owner } = addresses;
                const recoveryOwner = ethers.Wallet.createRandom().address;
                await expect(walletSetup(owner, [recoveryOwner])).to.be
                    .reverted;
            });

            it("should fail by providing an invalid recovery owner", async () => {
                const { owner, recoveryOwners } = addresses;
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                recoveryOwners[0] = caller.address;
                await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
            });

            it("should fail by providing address 0", async () => {
                const { owner, recoveryOwners } = addresses;
                recoveryOwners[0] = addrZero;
                await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
            });

            it("should fail by providing duplicate addresses", async () => {
                const { owner, recoveryOwners } = addresses;
                recoveryOwners[0] = recoveryOwners[1];
                await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
            });

            it("should fail by providing a guardian as recovery owner", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                recoveryOwners[0] = guardians[0];
                await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
            });

            it("should fail by providing the owner as recovery owner", async () => {
                const { owner, recoveryOwners } = addresses;
                recoveryOwners[0] = owner;
                await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
            });
        });

        describe("addRecoveryOwner()", () => {
            it("should fail by providing address zero", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [
                    addrZero,
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await sendTx(wallet, tx);
            });
        });
    });

    describe("Guardians", () => {
        describe("init()", () => {
            it("should fail by providing one guardian", async () => {
                const { owner, recoveryOwners } = addresses;
                const guardian = ethers.Wallet.createRandom().address;
                await expect(walletSetup(owner, recoveryOwners, [guardian])).to
                    .be.reverted;
            });

            it("should fail by providing an invalid guardian", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                guardians[0] = caller.address;
                await expect(walletSetup(owner, recoveryOwners, guardians)).to
                    .be.reverted;
            });

            it("should fail by providing address 0", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                guardians[0] = addrZero;
                await expect(walletSetup(owner, recoveryOwners, guardians)).to
                    .be.reverted;
            });

            it("should fail by providing duplicate addresses", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                guardians[0] = guardians[1];
                await expect(walletSetup(owner, recoveryOwners, guardians)).to
                    .be.reverted;
            });

            it("should fail by providing the owner as guardian", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                guardians[0] = owner;
                await expect(walletSetup(owner, recoveryOwners, guardians)).to
                    .be.reverted;
            });
        });
    });
});
