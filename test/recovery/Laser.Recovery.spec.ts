import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import {
    walletSetup,
    sign,
    generateTransaction,
    addressesForTest,
    signersForTest,
    AddressesForTest,
    encodeFunctionData,
    getHash,
    sendTx,
    isAddress,
    SignersForTest,
    signAndBundle,
    getRecoveryHash,
} from "../utils";
import { Address, Domain, Transaction } from "../types";
import { addrZero } from "../constants/constants";
import hre from "hardhat";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Smart Social Recovery", () => {
    let addresses: AddressesForTest;
    let signers: SignersForTest;
    let tx: Transaction;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        signers = await signersForTest();
        tx = generateTransaction();
    });

    // describe("Guardians", () => {
    //     describe("init()", () => {
    //         it("should fail by providing no guardians", async () => {
    //             const { owner, recoveryOwners } = addresses;
    //             const guardian = ethers.Wallet.createRandom().address;
    //             await expect(walletSetup(owner, recoveryOwners, [""])).to.be.reverted;
    //         });

    //         it("should fail by providing an invalid guardian", async () => {
    //             const { owner, recoveryOwners, guardians } = addresses;
    //             const Caller = await ethers.getContractFactory("Caller");
    //             const caller = await Caller.deploy();
    //             guardians[0] = caller.address;
    //             await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
    //         });

    //         it("should fail by providing address 0", async () => {
    //             const { owner, recoveryOwners, guardians } = addresses;
    //             guardians[0] = addrZero;
    //             await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
    //         });

    //         it("should fail by providing duplicate addresses", async () => {
    //             const { owner, recoveryOwners, guardians } = addresses;
    //             guardians[0] = guardians[1];
    //             await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
    //         });

    //         it("should fail by providing the owner as guardian", async () => {
    //             const { owner, recoveryOwners, guardians } = addresses;
    //             guardians[0] = owner;
    //             await expect(walletSetup(owner, recoveryOwners, guardians)).to.be.reverted;
    //         });
    //     });

    //     describe("addGuardian()", () => {
    //         it("should fail by providing address zero", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             tx.callData = encodeFunctionData(abi, "addGuardian", [addrZero]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             const guardians = await wallet.getGuardians();
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should fail by providing a recovery owner", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             const recoveryOwners = await wallet.getRecoveryOwners();
    //             tx.callData = encodeFunctionData(abi, "addGuardian", [recoveryOwners[0]]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should fail by providing a duplicate guardian", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             const guardians = await wallet.getGuardians();
    //             tx.callData = encodeFunctionData(abi, "addGuardian", [guardians[0]]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should fail by providing the owner", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             tx.callData = encodeFunctionData(abi, "addGuardian", [await wallet.owner()]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should fail by providing a contract without 1271 support", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             const Caller = await ethers.getContractFactory("Caller");
    //             const caller = await Caller.deploy();
    //             tx.callData = encodeFunctionData(abi, "addGuardian", [caller.address]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should add a guardian", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             const newGuardian = ethers.Wallet.createRandom().address;
    //             tx.callData = encodeFunctionData(abi, "addGuardian", [newGuardian]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             const transaction = await sendTx(wallet, tx);
    //             expect(transaction.events[0].event).to.equal("NewGuardian");

    //             expect(isAddress(await wallet.getGuardians(), newGuardian));
    //         });
    //     });

    //     describe("removeGuardian()", () => {
    //         let randomAddress1: Address;
    //         let randomAddress2: Address;
    //         let randomAddress3: Address;

    //         beforeEach(async () => {
    //             randomAddress1 = ethers.Wallet.createRandom().address;
    //             randomAddress2 = ethers.Wallet.createRandom().address;
    //             randomAddress3 = ethers.Wallet.createRandom().address;
    //         });

    //         it("should not allow to remove while providing an incorrect previous guardian", async () => {
    //             const _guardians = [randomAddress1, randomAddress2, randomAddress3, addresses.guardians[0]];
    //             const { address, wallet } = await walletSetup(undefined, undefined, _guardians);
    //             tx.to = address;
    //             const guardians = await wallet.getGuardians();
    //             const prevGuardian = "0x0000000000000000000000000000000000000001";
    //             const guardianToRemove = guardians[1];
    //             tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should not allow to remove if provided with the pointer", async () => {
    //             const _guardians = [randomAddress1, randomAddress2, randomAddress3, addresses.guardians[0]];
    //             const { address, wallet } = await walletSetup(undefined, undefined, _guardians);
    //             tx.to = address;
    //             const guardians = await wallet.getGuardians();
    //             const prevGuardian = guardians[0];
    //             const guardianToRemove = "0x0000000000000000000000000000000000000001";
    //             tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should not allow to remove if there is only 1 guardian", async () => {
    //             const gs = [addresses.guardians[0]];
    //             const { address, wallet } = await walletSetup(undefined, undefined, gs);
    //             tx.to = address;
    //             const guardians = await wallet.getGuardians();
    //             const prevGuardian = "0x0000000000000000000000000000000000000001";
    //             const guardianToRemove = guardians[0];
    //             tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should remove a guardian", async () => {
    //             const _guardians = [randomAddress1, randomAddress2, randomAddress3, addresses.guardians[0]];
    //             const { address, wallet } = await walletSetup(undefined, undefined, _guardians);
    //             tx.to = address;
    //             const guardians = await wallet.getGuardians();
    //             const prevGuardian = guardians[0];
    //             const guardianToRemove = guardians[1];
    //             expect(isAddress(guardians, guardianToRemove)).to.equal(true);
    //             tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
    //             await sendTx(wallet, tx);

    //             const postGuardians = await wallet.getGuardians();
    //             expect(postGuardians.length).to.equal(3);
    //             expect(isAddress(postGuardians, guardianToRemove)).to.equal(false);
    //         });
    //     });
    // });

    // describe("Recovery Owners", () => {
    //     describe("init()", () => {
    //         it("should fail by providing no recovery owner", async () => {
    //             const { owner } = addresses;
    //             const recoveryOwner = ethers.Wallet.createRandom().address;
    //             await expect(walletSetup(owner, [""])).to.be.reverted;
    //         });

    //         it("should fail by providing an invalid recovery owner", async () => {
    //             const { owner, recoveryOwners } = addresses;
    //             const Caller = await ethers.getContractFactory("Caller");
    //             const caller = await Caller.deploy();
    //             recoveryOwners[0] = caller.address;
    //             await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
    //         });

    //         it("should fail by providing address 0", async () => {
    //             const { owner, recoveryOwners } = addresses;
    //             recoveryOwners[0] = addrZero;
    //             await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
    //         });

    //         it("should fail by providing duplicate addresses", async () => {
    //             const { owner, recoveryOwners } = addresses;
    //             recoveryOwners[0] = recoveryOwners[1];
    //             await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
    //         });

    //         it("should fail by providing a guardian as recovery owner", async () => {
    //             const { owner, recoveryOwners, guardians } = addresses;
    //             recoveryOwners[0] = guardians[0];
    //             await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
    //         });

    //         it("should fail by providing the owner as recovery owner", async () => {
    //             const { owner, recoveryOwners } = addresses;
    //             recoveryOwners[0] = owner;
    //             await expect(walletSetup(owner, recoveryOwners)).to.be.reverted;
    //         });
    //     });

    //     describe("addRecoveryOwner()", () => {
    //         it("should fail by providing address zero", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [addrZero]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should fail by providing a guardian", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             const guardians = await wallet.getGuardians();
    //             tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [guardians[0]]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should fail by providing a duplicate recovery owner", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             const recoveryOwners = await wallet.getRecoveryOwners();
    //             tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [recoveryOwners[0]]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should fail by providing the owner", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [await wallet.owner()]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should fail by providing a contract without 1271 support", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             const Caller = await ethers.getContractFactory("Caller");
    //             const caller = await Caller.deploy();
    //             tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [caller.address]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should add a recovery owner", async () => {
    //             const { address, wallet } = await walletSetup();
    //             tx.to = address;
    //             const newRecoveryOwner = ethers.Wallet.createRandom().address;
    //             tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [newRecoveryOwner]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             const transaction = await sendTx(wallet, tx);
    //             expect(transaction.events[0].event).to.equal("NewRecoveryOwner");
    //             expect(isAddress(await wallet.getRecoveryOwners(), newRecoveryOwner));
    //         });
    //     });

    //     describe("removeRecoveryOwner()", () => {
    //         let randomAddress1: Address;
    //         let randomAddress2: Address;
    //         let randomAddress3: Address;

    //         beforeEach(async () => {
    //             randomAddress1 = ethers.Wallet.createRandom().address;
    //             randomAddress2 = ethers.Wallet.createRandom().address;
    //             randomAddress3 = ethers.Wallet.createRandom().address;
    //         });

    //         it("should not allow to remove while providing an incorrect previous recovery owner", async () => {
    //             const rOwners = [randomAddress1, randomAddress2, randomAddress3, addresses.recoveryOwners[0]];
    //             const { address, wallet } = await walletSetup(undefined, rOwners);
    //             tx.to = address;
    //             const recoveryOwners = await wallet.getRecoveryOwners();
    //             const prevRecoveryOwner = "0x0000000000000000000000000000000000000001";
    //             const recoveryOwnerToRemove = recoveryOwners[1];
    //             tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
    //                 prevRecoveryOwner,
    //                 recoveryOwnerToRemove,
    //             ]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should not allow to remove if provided with the pointer", async () => {
    //             const rOwners = [randomAddress1, randomAddress2, randomAddress3, addresses.recoveryOwners[0]];
    //             const { address, wallet } = await walletSetup(undefined, rOwners);
    //             tx.to = address;
    //             const recoveryOwners = await wallet.getRecoveryOwners();
    //             const prevRecoveryOwner = recoveryOwners[0];
    //             const recoveryOwnerToRemove = "0x0000000000000000000000000000000000000001";
    //             tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
    //                 prevRecoveryOwner,
    //                 recoveryOwnerToRemove,
    //             ]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should not allow to remove if there is only 1 recovery owner", async () => {
    //             const rOwners = [addresses.recoveryOwners[0]];
    //             const { address, wallet } = await walletSetup(undefined, rOwners);
    //             tx.to = address;
    //             const recoveryOwners = await wallet.getRecoveryOwners();
    //             const prevRecoveryOwner = "0x0000000000000000000000000000000000000001";
    //             const recoveryOwnerToRemove = recoveryOwners[0];
    //             tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
    //                 prevRecoveryOwner,
    //                 recoveryOwnerToRemove,
    //             ]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
    //         });

    //         it("should remove a recovery owner", async () => {
    //             const rOwners = [randomAddress1, randomAddress2, randomAddress3, addresses.recoveryOwners[0]];
    //             const { address, wallet } = await walletSetup(undefined, rOwners);
    //             tx.to = address;
    //             const recoveryOwners = await wallet.getRecoveryOwners();
    //             const prevRecoveryOwner = recoveryOwners[0];
    //             const recoveryOwnerToRemove = recoveryOwners[1];
    //             expect(isAddress(recoveryOwners, recoveryOwnerToRemove)).to.equal(true);
    //             tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
    //                 prevRecoveryOwner,
    //                 recoveryOwnerToRemove,
    //             ]);
    //             const hash = await getHash(wallet, tx);
    //             tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
    //             await sendTx(wallet, tx);
    //             const postRecoveryOwners = await wallet.getRecoveryOwners();
    //             expect(postRecoveryOwners.length).to.equal(3);
    //             expect(isAddress(postRecoveryOwners, recoveryOwnerToRemove)).to.equal(false);
    //         });
    //     });
    // });

    describe("Smart Social Recovery", () => {
        describe("recovery", () => {
            it("should revert if we try to call an invalid function", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const newGuardian = ethers.Wallet.createRandom().address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [newGuardian]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                await expect(wallet.recovery(tx.nonce, tx.callData, tx.signatures)).to.be.revertedWith(
                    "LW__recovery__invalidOperation()"
                );
            });
        });

        describe("lock()", () => {
            let callData: string;

            beforeEach(async () => {
                callData = encodeFunctionData(abi, "lock", []);
                tx.callData = callData;
            });

            it("should not be allowed to be called by a single signer", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await sign(signers.recoveryOwner1Signer, hash);

                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recovery__invalidSignatureLength()"
                );
            });

            it("should not be allowed to be called by a recovery owner + random signer ", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signer = ethers.Wallet.createRandom();
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signer, hash);

                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recoveryLock__invalidSignature()"
                );
            });

            it("should not be allowed to be called by a guardian + recovery owner (reverse)", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.guardian1Signer, signers.recoveryOwner1Signer, hash);

                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recoveryLock__invalidSignature()"
                );
            });

            it("should lock the wallet (recovery owner + recovery owner)", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = signAndBundle(signers.recoveryOwner1Signer, signers.recoveryOwner2Signer, hash);

                await wallet.recovery(await wallet.nonce(), callData, signatures);

                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);
            });

            it("should lock the wallet (recovery owner + guardian)", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                await wallet.recovery(await wallet.nonce(), callData, signatures);

                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);
            });

            it("should lock the wallet and emit event", async () => {
                const { wallet } = await walletSetup();

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                expect(await wallet.recovery(await wallet.nonce(), callData, signatures)).to.emit(abi, "WalletLocked");
            });
        });

        // describe("unlock()", () => {
        //     let callData: string;
        //     let tx: Transaction;

        //     beforeEach(async () => {
        //         callData = encodeFunctionData(abi, "unlock", []);
        //         tx = generateTransaction();
        //         tx.callData = callData;
        //     });

        //     it("should not be allowed to be called by the owner", async () => {
        //         const { address, wallet } = await walletSetup();
        //         tx.to = address;
        //         const hash = await getHash(wallet, tx);
        //         const { ownerSigner } = await signersForTest();
        //         tx.signatures = await sign(ownerSigner, hash);
        //         await fundWallet(ownerSigner, address);
        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__invalidSignatureLength()'");
        //     });

        //     it("should not be allowed to be called by any single signer", async () => {
        //         const { address, wallet } = await walletSetup();
        //         tx.to = address;
        //         const hash = await getHash(wallet, tx);
        //         const { ownerSigner } = await signersForTest();
        //         await fundWallet(ownerSigner, address);
        //         for (let i = 0; i < 10; i++) {
        //             const randomSigner = ethers.Wallet.createRandom();
        //             tx.signatures = await sign(randomSigner, hash);
        //             await expect(sendTx(wallet, tx)).to.be.revertedWith(
        //                 "'LW__verifySignatures__invalidSignatureLength()'"
        //             );
        //         }
        //     });

        //     it("should not be allowed to be called by the owner + a recovery owner", async () => {
        //         const { address, wallet } = await walletSetup();
        //         tx.to = address;
        //         const { recoveryOwner1Signer, ownerSigner } = await signersForTest();
        //         await fundWallet(ownerSigner, address);

        //         const hash = await getHash(wallet, tx);
        //         const sig1 = await sign(ownerSigner, hash);
        //         const sig2 = await sign(recoveryOwner1Signer, hash);
        //         tx.signatures = sig1 + sig2.slice(2);
        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notGuardian()'");
        //     });

        //     it("should not be allowed to be called by a recovery owner + owner", async () => {
        //         const { address, wallet } = await walletSetup();
        //         tx.to = address;
        //         const { recoveryOwner1Signer, ownerSigner } = await signersForTest();
        //         await fundWallet(ownerSigner, address);

        //         const hash = await getHash(wallet, tx);
        //         const sig1 = await sign(recoveryOwner1Signer, hash);
        //         const sig2 = await sign(ownerSigner, hash);
        //         tx.signatures = sig1 + sig2.slice(2);
        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
        //     });

        //     it("should not be allowed to be called by the guardian + owner (reverse order)", async () => {
        //         const { address, wallet } = await walletSetup();
        //         tx.to = address;
        //         const { guardian1Signer, ownerSigner } = await signersForTest();
        //         await fundWallet(ownerSigner, address);

        //         const hash = await getHash(wallet, tx);
        //         const sig1 = await sign(guardian1Signer, hash);
        //         const sig2 = await sign(ownerSigner, hash);
        //         tx.signatures = sig1 + sig2.slice(2);
        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
        //     });

        //     it("owner + guardian should be able to unlock the wallet", async () => {
        //         const { address, wallet } = await walletSetup();
        //         tx.to = address;
        //         const { guardian1Signer, ownerSigner } = await signersForTest();
        //         await fundWallet(ownerSigner, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         // Wallet is locked.
        //         expect(await wallet.isLocked()).to.equal(true);

        //         // Now we unlock the wallet.
        //         tx.nonce = 1; // We increase the nonce to 1 (lock wallet was 0).
        //         const hash = await getHash(wallet, tx);
        //         const ownerSig = await sign(ownerSigner, hash);
        //         const guardianSig = await sign(guardian1Signer, hash);
        //         tx.signatures = ownerSig + guardianSig.slice(2);
        //         await sendTx(wallet, tx);
        //         expect(await wallet.isLocked()).to.equal(false);
        //     });
        // });

        // describe("recover()", () => {
        //     let callData: string;
        //     let tx: Transaction;
        //     let newOwner: Address;

        //     beforeEach(async () => {
        //         newOwner = ethers.Wallet.createRandom().address;
        //         callData = encodeFunctionData(abi, "recover", [newOwner]);
        //         tx = generateTransaction();
        //         tx.callData = callData;
        //     });

        //     it("should not be allowed to be called prior to activating the timelock", async () => {
        //         const { address, wallet } = await walletSetup();
        //         tx.to = address;
        //         const hash = await getHash(wallet, tx);
        //         const { recoveryOwner1Signer } = await signersForTest();
        //         tx.signatures = await sign(recoveryOwner1Signer, hash);
        //         expect(await wallet.isLocked()).to.equal(false);
        //         expect(Number(await wallet.timeLock())).to.equal(0);
        //         await fundWallet(recoveryOwner1Signer, address);
        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("'SSR__timeLockVerifier__notActivated()'");
        //     });

        //     it("should not be allowed to be called before 1 week after locking the wallet", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { guardian1Signer } = await signersForTest();
        //         await fundWallet(guardian1Signer, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);
        //         tx.signatures = await sign(guardian1Signer, hash);

        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("'SSR__timeLockVerifier__lessThanOneWeek()'");
        //     });

        //     it("should not be allowed to be called seconds prior 1 week", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { guardian1Signer, recoveryOwner1Signer } = await signersForTest();
        //         await fundWallet(guardian1Signer, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week '604700 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604700],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         const recoveryOwnerSig = await sign(recoveryOwner1Signer, hash);
        //         const guardianSig = await sign(guardian1Signer, hash);

        //         tx.signatures = recoveryOwnerSig + guardianSig.slice(2);

        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("'SSR__timeLockVerifier__lessThanOneWeek()'");
        //     });

        //     it("should not be allowed to be called by the owner", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { ownerSigner, guardian1Signer } = await signersForTest();
        //         await fundWallet(ownerSigner, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week + 1 second '604801 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604801],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         const ownerSig = await sign(ownerSigner, hash);

        //         tx.signatures = ownerSig;

        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__invalidSignatureLength()");
        //     });

        //     it("should not be allowed to be called by any single signer", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { ownerSigner, guardian1Signer } = await signersForTest();
        //         await fundWallet(ownerSigner, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week + 1 second '604801 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604801],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         for (let i = 0; i < 10; i++) {
        //             const signer = ethers.Wallet.createRandom();
        //             const sig = await sign(signer, hash);
        //             tx.signatures = sig;
        //             await expect(sendTx(wallet, tx)).to.be.revertedWith(
        //                 "LW__verifySignatures__invalidSignatureLength()"
        //             );
        //         }
        //     });

        //     it("should not be allowed to be called by the owner + a guardian", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { guardian1Signer, ownerSigner } = await signersForTest();
        //         await fundWallet(guardian1Signer, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week + 1 second '604801 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604801],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         const ownerSig = await sign(ownerSigner, hash);
        //         const guardianSig = await sign(guardian1Signer, hash);

        //         tx.signatures = ownerSig + guardianSig.slice(2);

        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notRecoveryOwner()");
        //     });

        //     it("should not be allowed to be called by the owner + a recovery owner", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { guardian1Signer, recoveryOwner1Signer, ownerSigner } = await signersForTest();
        //         await fundWallet(guardian1Signer, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week + 1 second '604801 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604801],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         const ownerSig = await sign(ownerSigner, hash);
        //         const recoveryOwnerSig = await sign(recoveryOwner1Signer, hash);

        //         tx.signatures = ownerSig + recoveryOwnerSig.slice(2);

        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notRecoveryOwner()");
        //     });

        //     it("should not be allowed to be called by a guardian + a recovery owner", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { guardian1Signer, recoveryOwner1Signer } = await signersForTest();
        //         await fundWallet(guardian1Signer, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week + 1 second '604801 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604801],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         const guardianSig = await sign(guardian1Signer, hash);
        //         const recoveryOwnerSig = await sign(recoveryOwner1Signer, hash);

        //         tx.signatures = guardianSig + recoveryOwnerSig.slice(2);

        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notRecoveryOwner()");
        //     });

        //     it("should not be allowed to be called by a recovery owner + a recovery owner", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { guardian1Signer, recoveryOwner1Signer } = await signersForTest();
        //         await fundWallet(guardian1Signer, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week + 1 second '604801 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604801],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         const recoveryOwnersig1 = await sign(recoveryOwner1Signer, hash);
        //         const recoveryOwnerSig2 = await sign(recoveryOwner1Signer, hash);

        //         tx.signatures = recoveryOwnersig1 + recoveryOwnerSig2.slice(2);

        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notGuardian()");
        //     });

        //     it("should not be allowed to be called by a recovery owner + the owner", async () => {
        //         const { address, wallet } = await walletSetup();

        //         // First we lock the wallet.
        //         const { guardian1Signer, recoveryOwner1Signer, ownerSigner } = await signersForTest();
        //         await fundWallet(guardian1Signer, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week + 1 second '604801 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604801],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         const recoveryOwnersig = await sign(recoveryOwner1Signer, hash);
        //         const ownerSig = await sign(ownerSigner, hash);

        //         tx.signatures = recoveryOwnersig + ownerSig.slice(2);

        //         await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notGuardian()");
        //     });

        //     it("should recover to a new owner after 1 week (recovery owner + guardian)", async () => {
        //         const { address, wallet } = await walletSetup();

        //         const { owner } = addresses;
        //         expect(await wallet.owner()).to.equal(owner);
        //         // First we lock the wallet.
        //         const { guardian1Signer, recoveryOwner1Signer } = await signersForTest();
        //         await fundWallet(guardian1Signer, address);
        //         await lockWallet(wallet, guardian1Signer);
        //         expect(await wallet.isLocked()).to.equal(true);
        //         expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

        //         // we increase the time by 1 week + 1 second '604801 seconds'
        //         await hre.network.provider.request({
        //             method: "evm_increaseTime",
        //             params: [604801],
        //         });
        //         await hre.network.provider.send("evm_mine");

        //         tx.to = address;
        //         tx.nonce = 1;
        //         const hash = await getHash(wallet, tx);

        //         const recoveryOwnerSig = await sign(recoveryOwner1Signer, hash);
        //         const guardianSig = await sign(guardian1Signer, hash);

        //         tx.signatures = recoveryOwnerSig + guardianSig.slice(2);

        //         await sendTx(wallet, tx);
        //         expect(await wallet.owner()).to.equal(newOwner);
        //     });
        // });
    });

    // describe("lock()", () => {
    //     it("should fail by providing incorrect calldata", async () => {});

    //     it("should lock the wallet", async () => {
    //         const { address, wallet, SSR } = await walletSetup();

    //         const txData = encodeFunctionData(abi, "lock", []);
    //         const { recoveryOwner1Signer, guardian1Signer } = await signersForTest();

    //         const module = new ethers.Contract(SSR, moduleAbi, recoveryOwner1Signer);
    //         const hash = await module.operationHash(address, txData, await wallet.nonce(), 0, 0, 0);

    //         const sig = await sign(recoveryOwner1Signer, hash);
    //         const sig2 = await sign(guardian1Signer, hash);
    //         const sigs = sig + sig2.slice(2);

    //         // wallet is not locked.
    //         expect(await wallet.isLocked()).to.equal(false);

    //         await module.lock(address, txData, 0, 0, 0, addrZero, sigs);

    //         // wallet is locked.
    //         expect(await wallet.isLocked()).to.equal(true);
    //     });
    // });

    // describe("unlock()", () => {
    //     it("should unlock the wallet (owner + guardian)", async () => {
    //         const { address, wallet, SSR } = await walletSetup();

    //         const txData = encodeFunctionData(abi, "lock", []);
    //         const { ownerSigner, recoveryOwner1Signer, guardian1Signer } = await signersForTest();

    //         const module = new ethers.Contract(SSR, moduleAbi, recoveryOwner1Signer);
    //         const hash = await module.operationHash(address, txData, await wallet.nonce(), 0, 0, 0);

    //         const sig = await sign(recoveryOwner1Signer, hash);
    //         const sig2 = await sign(guardian1Signer, hash);
    //         const sigs = sig + sig2.slice(2);

    //         // wallet is not locked.
    //         expect(await wallet.isLocked()).to.equal(false);

    //         await module.lock(address, txData, 0, 0, 0, addrZero, sigs);

    //         // Wallet is locked.
    //         expect(await wallet.isLocked()).to.equal(true);

    //         // Now we need to unlock the wallet.
    //         const unlockTxData = encodeFunctionData(abi, "unlock", []);
    //         const hash2 = await module.operationHash(address, unlockTxData, await wallet.nonce(), 0, 0, 0);

    //         const unlockSig = await sign(ownerSigner, hash2);
    //         const unlockSig2 = await sign(guardian1Signer, hash2);
    //         const unlockSigs = unlockSig + unlockSig2.slice(2);

    //         await module.unlock(address, unlockTxData, 0, 0, 0, addrZero, unlockSigs);

    //         expect(await wallet.isLocked()).to.equal(false);
    //     });
    // });

    describe("multi call", () => {
        // Repeat the process.
    });
});
