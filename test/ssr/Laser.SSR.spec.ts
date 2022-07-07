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
import { Address, Domain, Transaction } from "../types";
import { addrZero, ownerWallet } from "../constants/constants";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

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
                await expect(wallet.init(owner, recoveryOwners, guardians)).to.be.revertedWith(
                    "'Owner__initOwner__walletInitialized()'"
                );
            });
        });
    });

    describe("Recovery Owners", () => {
        describe("init()", () => {
            it("should fail by providing one recovery owner", async () => {
                const { owner } = addresses;
                const recoveryOwner = ethers.Wallet.createRandom().address;
                await expect(walletSetup(owner, [recoveryOwner])).to.be.reverted;
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
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [addrZero]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const recoveryOwners = await wallet.getRecoveryOwners();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            });

            it("should fail by providing a guardian", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const guardians = await wallet.getGuardians();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [guardians[0]]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const recoveryOwners = await wallet.getRecoveryOwners();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            });

            it("should fail by providing a duplicate recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const recoveryOwners = await wallet.getRecoveryOwners();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [recoveryOwners[0]]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            });

            it("should fail by providing the owner", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const owner = await wallet.owner();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [owner]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const recoveryOwners = await wallet.getRecoveryOwners();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            });

            it("should fail by providing a contract without 1271 support", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [caller.address]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const recoveryOwners = await wallet.getRecoveryOwners();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            });
        });

        describe("removeRecoveryOwner()", () => {
            it("should not allow to have less than 2 recovery owners", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const recoveryOwnerToRemove = recoveryOwners[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
                    prevRecoveryOwner,
                    recoveryOwnerToRemove,
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            });
        });

        describe("swapRecoveryOwner()", () => {});
    });

    describe("Guardians", () => {
        describe("init()", () => {
            it("should fail by providing one guardian", async () => {
                const { owner, recoveryOwners } = addresses;
                const guardian = ethers.Wallet.createRandom().address;
                await expect(walletSetup(owner, recoveryOwners, [guardian])).to.be.reverted;
            });

            it("should fail by providing an invalid guardian", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                guardians[0] = caller.address;
                await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
            });

            it("should fail by providing address 0", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                guardians[0] = addrZero;
                await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
            });

            it("should fail by providing duplicate addresses", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                guardians[0] = guardians[1];
                await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
            });

            it("should fail by providing the owner as guardian", async () => {
                const { owner, recoveryOwners, guardians } = addresses;
                guardians[0] = owner;
                await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
            });
        });

        describe("addGuardian()", () => {
            it("should fail by providing address zero", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [addrZero]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const guardians = await wallet.getGuardians();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should fail by providing a recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const recoveryOwners = await wallet.getRecoveryOwners();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [recoveryOwners[0]]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const guardians = await wallet.getGuardians();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should fail by providing a duplicate guardian", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const guardians = await wallet.getGuardians();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [guardians[0]]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should fail by providing the owner", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const owner = await wallet.owner();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [owner]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const guardians = await wallet.getGuardians();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should fail by providing a contract without 1271 support", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [caller.address]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const guardians = await wallet.getGuardians();
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });
        });

        describe("removeGuardian()", () => {});

        describe("swapGuardian()", () => {});
    });

    describe("SSR in action", () => {
        describe("access()", () => {
            describe("this.lock.selector", () => {
                let callData: string;
                let tx: Transaction;

                beforeEach(async () => {
                    callData = encodeFunctionData(abi, "lock", []);
                    tx = await generateTransaction();
                    tx.callData = callData;
                });

                it("should not be allowed to be called by the owner", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const hash = await getHash(wallet, tx);
                    const { ownerSigner } = await signersForTest();
                    tx.signatures = await sign(ownerSigner, hash);
                    await fundWallet(ownerSigner, address);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notGuardian()'");
                });

                it("should not be allowed to be called by a recovery owner", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const hash = await getHash(wallet, tx);
                    const { recoveryOwner1Signer } = await signersForTest();
                    tx.signatures = await sign(recoveryOwner1Signer, hash);
                    await fundWallet(recoveryOwner1Signer, address);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notGuardian()'");
                });

                it("guardian should be able to lock the wallet", async () => {
                    const { address, wallet } = await walletSetup();
                    expect(await wallet.isLocked()).to.equal(false);
                    expect(await wallet.timeLock()).to.equal(0);

                    tx.to = address;
                    const hash = await getHash(wallet, tx);
                    const { guardian1Signer } = await signersForTest();
                    tx.signatures = await sign(guardian1Signer, hash);
                    await fundWallet(guardian1Signer, address);
                    await sendTx(wallet, tx);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);
                });

                it("should not be allowed to be called by random signers", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const { ownerSigner } = await signersForTest();
                    await fundWallet(ownerSigner, address);

                    for (let i = 0; i < 10; i++) {
                        const randomSigner = ethers.Wallet.createRandom();
                        const hash = await getHash(wallet, tx);
                        tx.signatures = await sign(randomSigner, hash);
                        await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notGuardian()'");
                    }
                });

                it("should not be allowed to be called when the guardians are locked", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const { guardian1Signer, ownerSigner, recoveryOwner1Signer } = await signersForTest();
                    await fundWallet(guardian1Signer, address);

                    expect(await wallet.guardiansLocked()).to.equal(false);

                    // First we lock the access for guardians.
                    tx.callData = encodeFunctionData(abi, "recoveryUnlock", []);
                    const hash = await getHash(wallet, tx);
                    const sig1 = await sign(ownerSigner, hash);
                    const sig2 = await sign(recoveryOwner1Signer, hash);
                    tx.signatures = sig1 + sig2.slice(2);
                    await sendTx(wallet, tx);
                    expect(await wallet.guardiansLocked()).to.equal(true);

                    // Guardian transaction.
                    tx.nonce = 1;
                    tx.callData = encodeFunctionData(abi, "lock", []);
                    const hash2 = await getHash(wallet, tx);
                    tx.signatures = await sign(guardian1Signer, hash2);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'SSR__access__guardiansLocked()'");
                });
            });

            describe("this.unlock.selector", () => {
                let callData: string;
                let tx: Transaction;

                beforeEach(async () => {
                    callData = encodeFunctionData(abi, "unlock", []);
                    tx = await generateTransaction();
                    tx.callData = callData;
                });

                it("should not be allowed to be called by the owner", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const hash = await getHash(wallet, tx);
                    const { ownerSigner } = await signersForTest();
                    tx.signatures = await sign(ownerSigner, hash);
                    await fundWallet(ownerSigner, address);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith(
                        "'LW__verifySignatures__invalidSignatureLength()'"
                    );
                });

                it("should not be allowed to be called by any single signer", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const hash = await getHash(wallet, tx);
                    const { ownerSigner } = await signersForTest();
                    await fundWallet(ownerSigner, address);
                    for (let i = 0; i < 10; i++) {
                        const randomSigner = ethers.Wallet.createRandom();
                        tx.signatures = await sign(randomSigner, hash);
                        await expect(sendTx(wallet, tx)).to.be.revertedWith(
                            "'LW__verifySignatures__invalidSignatureLength()'"
                        );
                    }
                });

                it("should not be allowed to be called by the owner + a recovery owner", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const { recoveryOwner1Signer, ownerSigner } = await signersForTest();
                    await fundWallet(ownerSigner, address);

                    const hash = await getHash(wallet, tx);
                    const sig1 = await sign(ownerSigner, hash);
                    const sig2 = await sign(recoveryOwner1Signer, hash);
                    tx.signatures = sig1 + sig2.slice(2);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notGuardian()'");
                });

                it("should not be allowed to be called by a recovery owner  + owner", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const { recoveryOwner1Signer, ownerSigner } = await signersForTest();
                    await fundWallet(ownerSigner, address);

                    const hash = await getHash(wallet, tx);
                    const sig1 = await sign(recoveryOwner1Signer, hash);
                    const sig2 = await sign(ownerSigner, hash);
                    tx.signatures = sig1 + sig2.slice(2);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
                });

                it("should not be allowed to be called by the guardian + owner (reverse order)", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const { guardian1Signer, ownerSigner } = await signersForTest();
                    await fundWallet(ownerSigner, address);

                    const hash = await getHash(wallet, tx);
                    const sig1 = await sign(guardian1Signer, hash);
                    const sig2 = await sign(ownerSigner, hash);
                    tx.signatures = sig1 + sig2.slice(2);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
                });

                it("owner + guardian should be able to unlock the wallet", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const { guardian1Signer, ownerSigner } = await signersForTest();
                    await fundWallet(ownerSigner, address);

                    const hash = await getHash(wallet, tx);
                    const sig1 = await sign(ownerSiger, hash);
                    const sig2 = await sign(guardian1Signer, hash);
                    tx.signatures = sig1 + sig2.slice(2);
                });
            });
        });

        describe("validateRecoveryOwner", () => {});

        describe("lock()", () => {});

        describe("unlock()", () => {});

        describe("recoveryUnlock()", () => {});

        describe("unlockGuardians()", () => {});

        describe("recover()", () => {});

        describe("scenarios", () => {});

        describe("multi call", () => {
            // Repeat the process.
        });
    });
});
