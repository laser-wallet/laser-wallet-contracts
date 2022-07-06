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
    fundWallet,
} from "../utils";
import { Address, Domain } from "../types";
import { addrZero, ownerWallet } from "../constants/constants";

const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Sovereign Social Recovery", () => {
    let addresses: AddressesForTest;
    let ownerSiger: Signer;

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
                await fundWallet(ownerSigner, address);
                const recoveryOwners = await wallet.getRecoveryOwners();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(
                    JSON.stringify(await wallet.getRecoveryOwners())
                );
            });

            it("should fail by providing a guardian", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const guardians = await wallet.getGuardians();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [
                    guardians[0],
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const recoveryOwners = await wallet.getRecoveryOwners();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(
                    JSON.stringify(await wallet.getRecoveryOwners())
                );
            });

            it("should fail by providing a duplicate recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const recoveryOwners = await wallet.getRecoveryOwners();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [
                    recoveryOwners[0],
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(
                    JSON.stringify(await wallet.getRecoveryOwners())
                );
            });

            it("should fail by providing the owner", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const owner = await wallet.owner();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [
                    owner,
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const recoveryOwners = await wallet.getRecoveryOwners();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(
                    JSON.stringify(await wallet.getRecoveryOwners())
                );
            });

            it("should fail by providing a contract without 1271 support", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [
                    caller.address,
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const recoveryOwners = await wallet.getRecoveryOwners();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(
                    JSON.stringify(await wallet.getRecoveryOwners())
                );
            });
        });

        describe("removeRecoveryOwner()", () => {});

        describe("swapRecoveryOwner()", () => {});
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

        describe("addGuardian()", () => {});

        describe("removeGuardian()", () => {});

        describe("swapGuardian()", () => {});
    });

    describe("SSR", () => {
        describe("access()", () => {});

        describe("validateRecoveryOwner", () => {});

        describe("lock()", () => {});

        describe("unlock()", () => {});

        describe("recoveryUnlock()", () => {});

        describe("unlockGuardians()", () => {});

        describe("recover()", () => {});

        describe("scenarios", () => {});
    });
});
