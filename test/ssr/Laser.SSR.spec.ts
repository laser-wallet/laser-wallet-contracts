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
    fundWallet,
    lockWallet,
    isAddress,
} from "../utils";
import { Address, Domain, Transaction } from "../types";
import { addrZero } from "../constants/constants";
import hre from "hardhat";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Smart Social Recovery", () => {
    let addresses: AddressesForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("Owner", async () => {
        it("should have the correct owner", async () => {
            const { wallet } = await walletSetup();
            const { owner } = addresses;
            expect(await wallet.owner()).to.equal(owner);
        });

        it("should not allow to init with address0", async () => {
            const { factory } = await walletSetup();
            const { recoveryOwners, guardians, relayer } = addresses;

            await expect(factory.deployProxyAndRefund(addrZero, recoveryOwners, guardians, 0, 0, 0, addrZero, "0x")).to
                .be.reverted;
        });

        it("should fail if we try to init after initialization", async () => {
            const { address, wallet } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = addresses;
            await expect(
                wallet.init(owner, recoveryOwners, guardians, 0, 0, 0, ethers.Wallet.createRandom().address, "0x")
            ).to.be.revertedWith("'SSR__initOwner__walletInitialized()'");
        });

        it("should not allow to init with address with code", async () => {
            const { address, factory } = await walletSetup();
            const { recoveryOwners, guardians, relayer } = addresses;
            await expect(factory.deployProxyAndRefund(address, recoveryOwners, guardians, 0, 0, 0, addrZero, "0x")).to
                .be.reverted;
        });
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

        describe("removeGuardian()", () => {
            let randomAddress1: Address;
            let randomAddress2: Address;
            let randomAddress3: Address;

            beforeEach(async () => {
                randomAddress1 = ethers.Wallet.createRandom().address;
                randomAddress2 = ethers.Wallet.createRandom().address;
                randomAddress3 = ethers.Wallet.createRandom().address;
            });

            it("should not allow to have less than 2 guardians", async () => {
                const { address, wallet } = await walletSetup();
                const tx = await generateTransaction();
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];
                const guardianToRemove = guardians[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should not allow to remove while providing an incorrect previous guardian", async () => {
                const _guardians = [randomAddress1, randomAddress2, randomAddress3];
                const { address, wallet } = await walletSetup(undefined, undefined, _guardians);
                const tx = await generateTransaction();
                const guardians = await wallet.getGuardians();
                const prevGuardian = "0x0000000000000000000000000000000000000001";
                const guardianToRemove = guardians[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should not allow to remove if provided with the pointer", async () => {
                const _guardians = [randomAddress1, randomAddress2, randomAddress3];
                const { address, wallet } = await walletSetup(undefined, _guardians);
                const tx = await generateTransaction();
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];
                const guardianToRemove = "0x0000000000000000000000000000000000000001";
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should remove a guardian", async () => {
                const _guardians = [randomAddress1, randomAddress2, randomAddress3];
                const { address, wallet } = await walletSetup(undefined, undefined, _guardians);
                const tx = await generateTransaction();
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];
                const guardianToRemove = guardians[1];
                expect(isAddress(guardians, guardianToRemove)).to.equal(true);
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "removeGuardian", [prevGuardian, guardianToRemove]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                await sendTx(wallet, tx);

                const postGuardians = await wallet.getGuardians();
                expect(postGuardians.length).to.equal(2);
                expect(isAddress(postGuardians, guardianToRemove)).to.equal(false);
            });
        });

        describe("swapGuardian()", () => {
            let newGuardian: Address;
            let tx: Transaction;

            beforeEach(async () => {
                tx = await generateTransaction();
                newGuardian = ethers.Wallet.createRandom().address;
            });

            it("should fail by providing an incorrect previous guardian", async () => {
                const { address, wallet } = await walletSetup();
                const guardians = await wallet.getGuardians();
                const prevGuardian = "0x0000000000000000000000000000000000000001";
                const oldGuardian = guardians[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapGuardian", [prevGuardian, newGuardian, oldGuardian]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should fail by providing the pointer as old guardian", async () => {
                const { address, wallet } = await walletSetup();
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[1];
                const oldGuardian = "0x0000000000000000000000000000000000000001";
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapGuardian", [prevGuardian, newGuardian, oldGuardian]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            });

            it("should fail if a guardian tries to swap a guardian", async () => {
                const { address, wallet } = await walletSetup();
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];
                const oldGuardian = guardians[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapGuardian", [prevGuardian, newGuardian, oldGuardian]);
                const hash = await getHash(wallet, tx);
                const { guardian1Signer } = await signersForTest();
                tx.signatures = await sign(guardian1Signer, hash);
                await fundWallet(guardian1Signer, address);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
            });

            it("should fail if a recovery owner tries to swap a guardian", async () => {
                const { address, wallet } = await walletSetup();
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];
                const oldGuardian = guardians[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapGuardian", [prevGuardian, newGuardian, oldGuardian]);
                const hash = await getHash(wallet, tx);
                const { recoveryOwner1Signer } = await signersForTest();
                tx.signatures = await sign(recoveryOwner1Signer, hash);
                await fundWallet(recoveryOwner1Signer, address);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
            });

            it("should fail if random signers try to swap a guardian", async () => {
                const { address, wallet } = await walletSetup();
                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];
                const oldGuardian = guardians[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapGuardian", [prevGuardian, newGuardian, oldGuardian]);
                const hash = await getHash(wallet, tx);
                const { recoveryOwner1Signer } = await signersForTest();

                await fundWallet(recoveryOwner1Signer, address);
                for (let i = 0; i < 10; i++) {
                    const signer = ethers.Wallet.createRandom();
                    tx.signatures = await sign(signer, hash);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
                }
            });

            it("should swap a guardian", async () => {
                const { address, wallet } = await walletSetup();

                // newGuardian is not yet on the wallet.
                expect(isAddress(await wallet.getGuardians(), newGuardian)).to.equal(false);

                const guardians = await wallet.getGuardians();
                const prevGuardian = guardians[0];

                const oldGuardian = guardians[1];

                // We confirm that the old guardian is a guardian.
                expect(isAddress(guardians, oldGuardian)).to.equal(true);

                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapGuardian", [prevGuardian, newGuardian, oldGuardian]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);

                // We send the transaction.
                await sendTx(wallet, tx);

                // new guardian is added.
                expect(isAddress(await wallet.getGuardians(), newGuardian));

                // old guardian is removed.
                expect(isAddress(await wallet.getGuardians(), oldGuardian)).to.equal(false);

                const postGuardians = await wallet.getGuardians();

                // new guardians should be on the same index.
                expect(postGuardians[1]).to.equal(newGuardian);
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
            let randomAddress1: Address;
            let randomAddress2: Address;
            let randomAddress3: Address;

            beforeEach(async () => {
                randomAddress1 = ethers.Wallet.createRandom().address;
                randomAddress2 = ethers.Wallet.createRandom().address;
                randomAddress3 = ethers.Wallet.createRandom().address;
            });

            it("should not allow to remove while providing an incorrect previous recovery owner", async () => {
                const rOwners = [randomAddress1, randomAddress2, randomAddress3];
                const { address, wallet } = await walletSetup(undefined, rOwners);
                const tx = await generateTransaction();
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = "0x0000000000000000000000000000000000000001";
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

            it("should not allow to remove if provided with the pointer", async () => {
                const rOwners = [randomAddress1, randomAddress2, randomAddress3];
                const { address, wallet } = await walletSetup(undefined, rOwners);
                const tx = await generateTransaction();
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const recoveryOwnerToRemove = "0x0000000000000000000000000000000000000001";
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

            it("should remove a recovery owner", async () => {
                const rOwners = [randomAddress1, randomAddress2, randomAddress3];
                const { address, wallet } = await walletSetup(undefined, rOwners);
                const tx = await generateTransaction();
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const recoveryOwnerToRemove = recoveryOwners[1];
                expect(isAddress(recoveryOwners, recoveryOwnerToRemove)).to.equal(true);
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "removeRecoveryOwner", [
                    prevRecoveryOwner,
                    recoveryOwnerToRemove,
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                await sendTx(wallet, tx);

                const postRecoveryOwners = await wallet.getRecoveryOwners();
                expect(postRecoveryOwners.length).to.equal(2);
                expect(isAddress(postRecoveryOwners, recoveryOwnerToRemove)).to.equal(false);
            });
        });

        describe("swapRecoveryOwner()", () => {
            let newRecoveryOwner: Address;
            let tx: Transaction;

            beforeEach(async () => {
                tx = await generateTransaction();
                newRecoveryOwner = ethers.Wallet.createRandom().address;
            });

            it("should fail by providing an incorrect previous recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                const recoveryowners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = "0x0000000000000000000000000000000000000001";
                const oldRecoveryOwner = recoveryowners[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapRecoveryOwner", [
                    prevRecoveryOwner,
                    newRecoveryOwner,
                    oldRecoveryOwner,
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryowners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            });

            it("should fail by providing the pointer as old recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[1];
                const oldRecoveryOwner = "0x0000000000000000000000000000000000000001";
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapRecoveryOwner", [
                    prevRecoveryOwner,
                    newRecoveryOwner,
                    oldRecoveryOwner,
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);
                const transaction = await sendTx(wallet, tx);
                expect(transaction.events[0].event).to.equal("ExecFailure");
                expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            });

            it("should fail if a recovery owner tries to swap a recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const oldRecoveryOwner = recoveryOwners[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapRecoveryOwner", [
                    prevRecoveryOwner,
                    newRecoveryOwner,
                    oldRecoveryOwner,
                ]);
                const hash = await getHash(wallet, tx);
                const { recoveryOwner1Signer } = await signersForTest();
                tx.signatures = await sign(recoveryOwner1Signer, hash);
                await fundWallet(recoveryOwner1Signer, address);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
            });

            it("should fail if a guardian tries to swap a recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const oldRecoveryOwner = recoveryOwners[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapRecoveryOwner", [
                    prevRecoveryOwner,
                    newRecoveryOwner,
                    oldRecoveryOwner,
                ]);
                const hash = await getHash(wallet, tx);
                const { guardian1Signer } = await signersForTest();
                tx.signatures = await sign(guardian1Signer, hash);
                await fundWallet(guardian1Signer, address);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
            });

            it("should fail if random signers try to swap a recovery owner", async () => {
                const { address, wallet } = await walletSetup();
                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const oldRecoveryOwner = recoveryOwners[1];
                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapRecoveryOwner", [
                    prevRecoveryOwner,
                    newRecoveryOwner,
                    oldRecoveryOwner,
                ]);
                const hash = await getHash(wallet, tx);
                const { recoveryOwner1Signer } = await signersForTest();

                await fundWallet(recoveryOwner1Signer, address);
                for (let i = 0; i < 10; i++) {
                    const signer = ethers.Wallet.createRandom();
                    tx.signatures = await sign(signer, hash);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'LW__verifySignatures__notOwner()'");
                }
            });

            it("should swap a recovery owner", async () => {
                const { address, wallet } = await walletSetup();

                // newRecoveryOwner is not yet on the wallet.
                expect(isAddress(await wallet.getRecoveryOwners(), newRecoveryOwner)).to.equal(false);

                const recoveryOwners = await wallet.getRecoveryOwners();
                const prevRecoveryOwner = recoveryOwners[0];
                const oldRecoveryOwner = recoveryOwners[1];

                // We confirm that the old recovery owner is a recovery owner.
                expect(isAddress(recoveryOwners, oldRecoveryOwner)).to.equal(true);

                tx.to = address;
                tx.callData = encodeFunctionData(abi, "swapRecoveryOwner", [
                    prevRecoveryOwner,
                    newRecoveryOwner,
                    oldRecoveryOwner,
                ]);
                const hash = await getHash(wallet, tx);
                const { ownerSigner } = await signersForTest();
                tx.signatures = await sign(ownerSigner, hash);
                await fundWallet(ownerSigner, address);

                // We send the transaction.
                await sendTx(wallet, tx);

                // new recovery owner is added.
                expect(isAddress(await wallet.getRecoveryOwners(), newRecoveryOwner)).to.equal(true);

                // old recovery owner is removed.
                expect(isAddress(await wallet.getRecoveryOwners(), oldRecoveryOwner)).to.equal(false);

                const postRecoveryOwners = await wallet.getRecoveryOwners();

                // new recovery owner should be on the same index.
                expect(postRecoveryOwners[1]).to.equal(newRecoveryOwner);
            });
        });
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

                it("should not be allowed to be called by a recovery owner + owner", async () => {
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
                    await lockWallet(wallet, guardian1Signer);
                    // Wallet is locked.
                    expect(await wallet.isLocked()).to.equal(true);

                    // Now we unlock the wallet.
                    tx.nonce = 1; // We increase the nonce to 1 (lock wallet was 0).
                    const hash = await getHash(wallet, tx);
                    const ownerSig = await sign(ownerSigner, hash);
                    const guardianSig = await sign(guardian1Signer, hash);
                    tx.signatures = ownerSig + guardianSig.slice(2);
                    await sendTx(wallet, tx);
                    expect(await wallet.isLocked()).to.equal(false);
                });
            });

            describe("this.recoveryUnlock.selector", () => {
                let callData: string;
                let tx: Transaction;

                beforeEach(async () => {
                    tx = await generateTransaction();
                    tx.callData = callData;
                });
            });

            describe("this.recover.selector", () => {
                let callData: string;
                let tx: Transaction;
                let newOwner: Address;

                beforeEach(async () => {
                    newOwner = ethers.Wallet.createRandom().address;
                    callData = encodeFunctionData(abi, "recover", [newOwner]);
                    tx = await generateTransaction();
                    tx.callData = callData;
                });

                it("should not be allowed to be called prior to activating the timelock", async () => {
                    const { address, wallet } = await walletSetup();
                    tx.to = address;
                    const hash = await getHash(wallet, tx);
                    const { recoveryOwner1Signer } = await signersForTest();
                    tx.signatures = await sign(recoveryOwner1Signer, hash);
                    expect(await wallet.isLocked()).to.equal(false);
                    expect(Number(await wallet.timeLock())).to.equal(0);
                    await fundWallet(recoveryOwner1Signer, address);
                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'SSR__timeLockVerifier__notActivated()'");
                });

                it("should not be allowed to be called before 1 week after locking the wallet", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { guardian1Signer } = await signersForTest();
                    await fundWallet(guardian1Signer, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);
                    tx.signatures = await sign(guardian1Signer, hash);

                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'SSR__timeLockVerifier__lessThanOneWeek()'");
                });

                it("should not be allowed to be called seconds prior 1 week", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { guardian1Signer, recoveryOwner1Signer } = await signersForTest();
                    await fundWallet(guardian1Signer, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week '604700 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604700],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    const recoveryOwnerSig = await sign(recoveryOwner1Signer, hash);
                    const guardianSig = await sign(guardian1Signer, hash);

                    tx.signatures = recoveryOwnerSig + guardianSig.slice(2);

                    await expect(sendTx(wallet, tx)).to.be.revertedWith("'SSR__timeLockVerifier__lessThanOneWeek()'");
                });

                it("should not be allowed to be called by the owner", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { ownerSigner, guardian1Signer } = await signersForTest();
                    await fundWallet(ownerSigner, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week + 1 second '604801 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604801],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    const ownerSig = await sign(ownerSigner, hash);

                    tx.signatures = ownerSig;

                    await expect(sendTx(wallet, tx)).to.be.revertedWith(
                        "LW__verifySignatures__invalidSignatureLength()"
                    );
                });

                it("should not be allowed to be called by any single signer", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { ownerSigner, guardian1Signer } = await signersForTest();
                    await fundWallet(ownerSigner, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week + 1 second '604801 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604801],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    for (let i = 0; i < 10; i++) {
                        const signer = ethers.Wallet.createRandom();
                        const sig = await sign(signer, hash);
                        tx.signatures = sig;
                        await expect(sendTx(wallet, tx)).to.be.revertedWith(
                            "LW__verifySignatures__invalidSignatureLength()"
                        );
                    }
                });

                it("should not be allowed to be called by the owner + a guardian", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { guardian1Signer, ownerSigner } = await signersForTest();
                    await fundWallet(guardian1Signer, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week + 1 second '604801 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604801],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    const ownerSig = await sign(ownerSigner, hash);
                    const guardianSig = await sign(guardian1Signer, hash);

                    tx.signatures = ownerSig + guardianSig.slice(2);

                    await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notRecoveryOwner()");
                });

                it("should not be allowed to be called by the owner + a recovery owner", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { guardian1Signer, recoveryOwner1Signer, ownerSigner } = await signersForTest();
                    await fundWallet(guardian1Signer, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week + 1 second '604801 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604801],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    const ownerSig = await sign(ownerSigner, hash);
                    const recoveryOwnerSig = await sign(recoveryOwner1Signer, hash);

                    tx.signatures = ownerSig + recoveryOwnerSig.slice(2);

                    await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notRecoveryOwner()");
                });

                it("should not be allowed to be called by a guardian + a recovery owner", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { guardian1Signer, recoveryOwner1Signer } = await signersForTest();
                    await fundWallet(guardian1Signer, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week + 1 second '604801 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604801],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    const guardianSig = await sign(guardian1Signer, hash);
                    const recoveryOwnerSig = await sign(recoveryOwner1Signer, hash);

                    tx.signatures = guardianSig + recoveryOwnerSig.slice(2);

                    await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notRecoveryOwner()");
                });

                it("should not be allowed to be called by a recovery owner + a recovery owner", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { guardian1Signer, recoveryOwner1Signer } = await signersForTest();
                    await fundWallet(guardian1Signer, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week + 1 second '604801 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604801],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    const recoveryOwnersig1 = await sign(recoveryOwner1Signer, hash);
                    const recoveryOwnerSig2 = await sign(recoveryOwner1Signer, hash);

                    tx.signatures = recoveryOwnersig1 + recoveryOwnerSig2.slice(2);

                    await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notGuardian()");
                });

                it("should not be allowed to be called by a recovery owner + the owner", async () => {
                    const { address, wallet } = await walletSetup();

                    // First we lock the wallet.
                    const { guardian1Signer, recoveryOwner1Signer, ownerSigner } = await signersForTest();
                    await fundWallet(guardian1Signer, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week + 1 second '604801 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604801],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    const recoveryOwnersig = await sign(recoveryOwner1Signer, hash);
                    const ownerSig = await sign(ownerSigner, hash);

                    tx.signatures = recoveryOwnersig + ownerSig.slice(2);

                    await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__verifySignatures__notGuardian()");
                });

                it("should recover to a new owner after 1 week (recovery owner + guardian)", async () => {
                    const { address, wallet } = await walletSetup();

                    const { owner } = addresses;
                    expect(await wallet.owner()).to.equal(owner);
                    // First we lock the wallet.
                    const { guardian1Signer, recoveryOwner1Signer } = await signersForTest();
                    await fundWallet(guardian1Signer, address);
                    await lockWallet(wallet, guardian1Signer);
                    expect(await wallet.isLocked()).to.equal(true);
                    expect(Number(await wallet.timeLock())).to.be.greaterThan(0);

                    // we increase the time by 1 week + 1 second '604801 seconds'
                    await hre.network.provider.request({
                        method: "evm_increaseTime",
                        params: [604801],
                    });
                    await hre.network.provider.send("evm_mine");

                    tx.to = address;
                    tx.nonce = 1;
                    const hash = await getHash(wallet, tx);

                    const recoveryOwnerSig = await sign(recoveryOwner1Signer, hash);
                    const guardianSig = await sign(guardian1Signer, hash);

                    tx.signatures = recoveryOwnerSig + guardianSig.slice(2);

                    await sendTx(wallet, tx);
                    expect(await wallet.owner()).to.equal(newOwner);
                });
            });
        });

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
