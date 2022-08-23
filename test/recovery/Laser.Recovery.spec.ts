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

    describe("Guardians", () => {
        describe("init()", () => {
            it("should fail by providing no guardians", async () => {
                const { owner, recoveryOwners } = addresses;
                const guardian = ethers.Wallet.createRandom().address;
                await expect(walletSetup(owner, recoveryOwners, [""])).to.be.reverted;
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
            it("should not allow to call the function directly", async () => {
                const { wallet } = await walletSetup();

                await expect(wallet.addGuardian(ethers.Wallet.createRandom().address)).to.be.revertedWith(
                    "Access__notAllowed()"
                );
            });

            it("should fail by providing address zero", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [addrZero]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                const guardians = await wallet.getGuardians();
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should fail by providing a recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const recoveryOwners = await wallet.getRecoveryOwners();
                tx.callData = encodeFunctionData(abi, "addGuardian", [recoveryOwners[0]]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should fail by providing a duplicate guardian", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const guardians = await wallet.getGuardians();
                tx.callData = encodeFunctionData(abi, "addGuardian", [guardians[0]]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should fail by providing the owner", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [await wallet.owner()]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should fail by providing a contract without 1271 support", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                tx.callData = encodeFunctionData(abi, "addGuardian", [caller.address]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should add a guardian", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const newGuardian = ethers.Wallet.createRandom().address;
                tx.callData = encodeFunctionData(abi, "addGuardian", [newGuardian]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("NewGuardian");

                expect(isAddress(await wallet.getGuardians(), newGuardian));
            });
        });

        describe("removeGuardian()", () => {
            let randomAddress1: Address;
            let randomAddress2: Address;
            let randomAddress3: Address;

            beforeEach(async () => {
                randomAddress1 = ethers.Wallet.createRandom().address;
                randomAddress2 = ethers.Wallet.createRandom().address;
                randomAddress3 = ethers.Wallet.createRandom().address;
            });

            it("should not allow to call the function directly", async () => {
                const { wallet } = await walletSetup();

                await expect(
                    wallet.removeGuardian(ethers.Wallet.createRandom().address, ethers.Wallet.createRandom().address)
                ).to.be.revertedWith("Access__notAllowed()");
            });

            it("should not allow to remove while providing an incorrect previous guardian", async () => {
                const _guardians = [randomAddress1, randomAddress2, randomAddress3, addresses.guardians[0]];
                const { address, wallet } = await walletSetup(undefined, undefined, _guardians);
                tx.to = address;
                const guardians = await wallet.getGuardians();
                const prevGuardian = "0x0000000000000000000000000000000000000001";
                const guardianToRemove = guardians[1];
                tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should not allow to remove if provided with the pointer", async () => {
                const _guardians = [randomAddress1, randomAddress2, randomAddress3, addresses.guardians[0]];
                const { address, wallet } = await walletSetup(undefined, undefined, _guardians);
                tx.to = address;
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];
                const guardianToRemove = "0x0000000000000000000000000000000000000001";
                tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should not allow to remove if there is only 1 guardian", async () => {
                const gs = [addresses.guardians[0]];
                const { address, wallet } = await walletSetup(undefined, undefined, gs);
                tx.to = address;
                const guardians = await wallet.getGuardians();
                const prevGuardian = "0x0000000000000000000000000000000000000001";
                const guardianToRemove = guardians[0];
                tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should remove a guardian", async () => {
                const _guardians = [randomAddress1, randomAddress2, randomAddress3, addresses.guardians[0]];
                const { address, wallet } = await walletSetup(undefined, undefined, _guardians);
                tx.to = address;
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];
                const guardianToRemove = guardians[1];
                expect(isAddress(guardians, guardianToRemove)).to.equal(true);
                tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);
                await sendTx(wallet, tx);

                const postGuardians = await wallet.getGuardians();
                expect(postGuardians.length).to.equal(3);
                expect(isAddress(postGuardians, guardianToRemove)).to.equal(false);
            });
        });
    });

    describe("Recovery Owners", () => {
        describe("init()", () => {
            it("should fail by providing no recovery owner", async () => {
                const { owner } = addresses;
                const recoveryOwner = ethers.Wallet.createRandom().address;
                await expect(walletSetup(owner, [""])).to.be.reverted;
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
            it("should not allow to call the function directly", async () => {
                const { wallet } = await walletSetup();

                await expect(wallet.addRecoveryOwner(ethers.Wallet.createRandom().address)).to.be.revertedWith(
                    "Access__notAllowed()"
                );
            });

            it("should fail by providing address zero", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [addrZero]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should fail by providing a guardian", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const guardians = await wallet.getGuardians();
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [guardians[0]]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should fail by providing a duplicate recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const recoveryOwners = await wallet.getRecoveryOwners();
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [recoveryOwners[0]]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should fail by providing the owner", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [await wallet.owner()]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should fail by providing a contract without 1271 support", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [caller.address]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should add a recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                tx.to = address;
                const newRecoveryOwner = ethers.Wallet.createRandom().address;
                tx.callData = encodeFunctionData(abi, "addRecoveryOwner", [newRecoveryOwner]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("NewRecoveryOwner");
                expect(isAddress(await wallet.getRecoveryOwners(), newRecoveryOwner));
            });
        });

        describe("removeRecoveryOwner()", () => {
            let randomAddress1: Address;
            let randomAddress2: Address;
            let randomAddress3: Address;

            beforeEach(async () => {
                randomAddress1 = ethers.Wallet.createRandom().address;
                randomAddress2 = ethers.Wallet.createRandom().address;
                randomAddress3 = ethers.Wallet.createRandom().address;
            });

            it("should not allow to call the function directly", async () => {
                const { wallet } = await walletSetup();

                await expect(
                    wallet.removeRecoveryOwner(
                        ethers.Wallet.createRandom().address,
                        ethers.Wallet.createRandom().address
                    )
                ).to.be.revertedWith("Access__notAllowed()");
            });

            it("should not allow to remove while providing an incorrect previous recovery owner", async () => {
                const rOwners = [randomAddress1, randomAddress2, randomAddress3, addresses.recoveryOwners[0]];
                const { address, wallet } = await walletSetup(undefined, rOwners);
                tx.to = address;
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = "0x0000000000000000000000000000000000000001";
                const recoveryOwnerToRemove = recoveryOwners[1];
                tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
                    prevRecoveryOwner,
                    recoveryOwnerToRemove,
                ]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should not allow to remove if provided with the pointer", async () => {
                const rOwners = [randomAddress1, randomAddress2, randomAddress3, addresses.recoveryOwners[0]];
                const { address, wallet } = await walletSetup(undefined, rOwners);
                tx.to = address;
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const recoveryOwnerToRemove = "0x0000000000000000000000000000000000000001";
                tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
                    prevRecoveryOwner,
                    recoveryOwnerToRemove,
                ]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should not allow to remove if there is only 1 recovery owner", async () => {
                const rOwners = [addresses.recoveryOwners[0]];
                const { address, wallet } = await walletSetup(undefined, rOwners);
                tx.to = address;
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = "0x0000000000000000000000000000000000000001";
                const recoveryOwnerToRemove = recoveryOwners[0];
                tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
                    prevRecoveryOwner,
                    recoveryOwnerToRemove,
                ]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
            });

            it("should remove a recovery owner", async () => {
                const rOwners = [randomAddress1, randomAddress2, randomAddress3, addresses.recoveryOwners[0]];
                const { address, wallet } = await walletSetup(undefined, rOwners);
                tx.to = address;
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const recoveryOwnerToRemove = recoveryOwners[1];
                expect(isAddress(recoveryOwners, recoveryOwnerToRemove)).to.equal(true);
                tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
                    prevRecoveryOwner,
                    recoveryOwnerToRemove,
                ]);
                const hash = await getHash(wallet, tx);
                tx.signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);
                await sendTx(wallet, tx);
                const postRecoveryOwners = await wallet.getRecoveryOwners();
                expect(postRecoveryOwners.length).to.equal(3);
                expect(isAddress(postRecoveryOwners, recoveryOwnerToRemove)).to.equal(false);
            });
        });
    });

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

            it("should revert if we provide duplicate signer", async () => {
                const { wallet } = await walletSetup();
                const callData = encodeFunctionData(abi, "lock", []);
                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.recoveryOwner1Signer,
                    hash
                );
                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recovery__duplicateSigner()"
                );
            });

            it("should revert if signature is too short", async () => {
                const { wallet } = await walletSetup();
                const callData = encodeFunctionData(abi, "lock", []);
                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.recoveryOwner1Signer,
                    hash
                );
                await expect(
                    wallet.recovery(await wallet.nonce(), callData, "0x" + signatures.slice(4))
                ).to.be.revertedWith("LW__recovery__invalidSignatureLength()");
            });
        });

        describe("lock()", () => {
            let callData: string;

            beforeEach(async () => {
                callData = encodeFunctionData(abi, "lock", []);
            });

            it("should not allow to call the function directly", async () => {
                const { wallet } = await walletSetup();

                await expect(wallet.lock()).to.be.revertedWith("Access__notAllowed()");
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

        describe("unlock()", () => {
            let callData: string;
            let lockData: string;

            beforeEach(async () => {
                callData = encodeFunctionData(abi, "unlock", []);
                lockData = encodeFunctionData(abi, "lock", []);
            });

            it("should not allow to call the function directly", async () => {
                const { wallet } = await walletSetup();

                await expect(wallet.unlock()).to.be.revertedWith("Access__notAllowed()");
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

            it("should not be allowed to be called by a owner + random signer ", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signer = ethers.Wallet.createRandom();
                const signatures = await signAndBundle(signers.ownerSigner, signer, hash);

                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recoveryUnlock__invalidSignature()"
                );
            });

            it("should not be allowed to be called by a guardian + owner (reverse) ", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                const hash = await getRecoveryHash(wallet, callData);

                const signatures = await signAndBundle(signers.guardian1Signer, signers.ownerSigner, hash);

                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recoveryUnlock__invalidSignature()"
                );
            });

            it("should unlock the wallet (owner + recovery owner) ", async () => {
                const { wallet } = await walletSetup();

                // First we lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian1Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                // Wallet should be locked.
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.ownerSigner, signers.recoveryOwner1Signer, hash);

                await wallet.recovery(await wallet.nonce(), callData, signatures);

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);
            });

            it("should unlock the wallet (owner + guardian) ", async () => {
                const { wallet } = await walletSetup();

                // First we lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian1Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                // Wallet should be locked.
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.ownerSigner, signers.guardian2Signer, hash);

                await wallet.recovery(await wallet.nonce(), callData, signatures);

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);
            });

            it("should unlock the wallet and emit event ", async () => {
                const { wallet } = await walletSetup();

                // First we lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian1Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                // Wallet should be locked.
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.ownerSigner, signers.guardian2Signer, hash);

                expect(await wallet.recovery(await wallet.nonce(), callData, signatures)).to.emit(
                    abi,
                    "WalletUnlocked"
                );
            });
        });

        describe("recover()", () => {
            let callData: string;
            let lockData: string;
            let newOwner: Address;

            beforeEach(async () => {
                newOwner = ethers.Wallet.createRandom().address;
                callData = encodeFunctionData(abi, "recover", [newOwner]);
                lockData = encodeFunctionData(abi, "lock", []);
            });

            it("should not allow to call the function directly", async () => {
                const { wallet } = await walletSetup();

                await expect(wallet.recover(ethers.Wallet.createRandom().address)).to.be.revertedWith(
                    "Access__notAllowed()"
                );
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
                    "LW__recoveryRecover__invalidSignature()"
                );
            });

            it("should not be allowed to be called by a guardian + recovery owner (reversed order)", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.guardian1Signer, signers.recoveryOwner1Signer, hash);

                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recoveryRecover__invalidSignature()"
                );
            });

            it("should not be allowed to be called before 5 days after locking", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                // We lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian2Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);
                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recovery__callFailed()"
                );

                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);
            });

            it("should not be allowed to be called  1 day prior to the recovery period", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                // We lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian2Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                // We increase the time by 4 days.
                await hre.network.provider.request({
                    method: "evm_increaseTime",
                    params: [345600],
                });
                await hre.network.provider.send("evm_mine");

                await expect(wallet.recovery(await wallet.nonce(), callData, signatures)).to.be.revertedWith(
                    "LW__recovery__callFailed()"
                );

                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);
            });

            it("should fail if we provide the current owner as new owner", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                // We lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian2Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const badData = encodeFunctionData(abi, "recover", [await wallet.owner()]);
                const hash = await getRecoveryHash(wallet, badData);
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                // We increase the time by 5 days.
                await hre.network.provider.request({
                    method: "evm_increaseTime",
                    params: [432000],
                });
                await hre.network.provider.send("evm_mine");

                await expect(wallet.recovery(await wallet.nonce(), badData, signatures)).to.be.revertedWith(
                    "LW__recovery__callFailed()"
                );

                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);
            });

            it("should fail if we provide address 0 as new owner", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                // We lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian2Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const badData = encodeFunctionData(abi, "recover", [ethers.constants.AddressZero]);
                const hash = await getRecoveryHash(wallet, badData);
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                // We increase the time by 5 days.
                await hre.network.provider.request({
                    method: "evm_increaseTime",
                    params: [432000],
                });
                await hre.network.provider.send("evm_mine");

                await expect(wallet.recovery(await wallet.nonce(), badData, signatures)).to.be.revertedWith(
                    "LW__recovery__callFailed()"
                );

                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);
            });

            it("should fail if we provide an address with code as new owner", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                // We lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian2Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const Caller = await ethers.getContractFactory("Caller");
                const caller = await Caller.deploy();
                const badData = encodeFunctionData(abi, "recover", [caller.address]);
                const hash = await getRecoveryHash(wallet, badData);
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                // We increase the time by 5 days.
                await hre.network.provider.request({
                    method: "evm_increaseTime",
                    params: [432000],
                });
                await hre.network.provider.send("evm_mine");

                await expect(wallet.recovery(await wallet.nonce(), badData, signatures)).to.be.revertedWith(
                    "LW__recovery__callFailed()"
                );

                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);
            });

            it("should recover the wallet (recovery owner + guardian)", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                // We lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian2Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                // We increase the time by 5 days.
                await hre.network.provider.request({
                    method: "evm_increaseTime",
                    params: [432000],
                });
                await hre.network.provider.send("evm_mine");

                await wallet.recovery(await wallet.nonce(), callData, signatures);

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);
                expect(await wallet.owner()).to.equal(newOwner);
            });

            it("should recover the wallet (recovery owner + recovery owner)", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                // We lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian2Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                // We increase the time by 5 days.
                await hre.network.provider.request({
                    method: "evm_increaseTime",
                    params: [432000],
                });
                await hre.network.provider.send("evm_mine");

                await wallet.recovery(await wallet.nonce(), callData, signatures);

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);
                expect(await wallet.owner()).to.equal(newOwner);
            });

            it("should recover the wallet and emit event", async () => {
                const { wallet } = await walletSetup();

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);

                // We lock the wallet.
                const lockHash = await getRecoveryHash(wallet, lockData);
                const lockSignatures = await signAndBundle(
                    signers.recoveryOwner1Signer,
                    signers.guardian2Signer,
                    lockHash
                );
                await wallet.recovery(await wallet.nonce(), lockData, lockSignatures);
                expect(await wallet.isLocked()).to.equal(true);
                expect(await wallet.getConfigTimestamp()).to.not.equal(0);

                const hash = await getRecoveryHash(wallet, callData);
                const signatures = await signAndBundle(signers.recoveryOwner1Signer, signers.guardian1Signer, hash);

                await hre.network.provider.request({
                    method: "evm_increaseTime",
                    params: [832000],
                });
                await hre.network.provider.send("evm_mine");

                expect(await wallet.recovery(await wallet.nonce(), callData, signatures)).to.emit(
                    abi,
                    "WalletRecovered"
                );

                expect(await wallet.isLocked()).to.equal(false);
                expect(await wallet.getConfigTimestamp()).to.equal(0);
                expect(await wallet.owner()).to.equal(newOwner);
            });
        });
    });

    describe("multi call", () => {
        // Repeat the process.
    });
});
