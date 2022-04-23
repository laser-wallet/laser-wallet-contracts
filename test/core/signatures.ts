import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import {
    encodeFunctionData,
    addressZero,
    SENTINEL,
    paddedSignature,
    specialOwner,
    owner1,
    owner2,
    owner3,
    walletSetup,
    walletSetup2,
    safeTx,
    execTx,
    guardian,
    contractSignature,
    oneEth
} from "../utils";
import { SafeTx, types, TxMessage, Domain } from "../types";
import { signTypedData, sign } from "../utils/sign";

const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Signatures", () => {
    let relayer: Signer;
    let randy: Signer;
    let randyAddress: string;
    let txMessage: TxMessage;
    let exampleData: string;
    let _owner2: Signer;
    let domain: Domain;

    beforeEach(async () => {
        const accounts = await ethers.getSigners();
        relayer = accounts[19]; // account[0] is the special owner.
        _owner2 = accounts[2];
        randy = ethers.Wallet.createRandom();
        randyAddress = await randy.getAddress();
        txMessage = {
            to: "",
            value: 0,
            data: "0x",
            nonce: 0
        };
        exampleData = encodeFunctionData(abi, "changeThreshold", [1]);
        const { address, wallet } = await walletSetup(relayer);
        domain = {
            chainId: await wallet.getChainId(),
            verifyingContract: ""
        };
    });

    describe("Correct setup", () => {
        it("Init", async () => {
            const { address, wallet } = await walletSetup(relayer);
            await guardian(address);
        });
    });

    describe("Correct data", () => {
        it("should have correct domain separator", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain({
                verifyingContract: address,
                chainId: await wallet.getChainId()
            });
            expect(domainSeparator).to.equal(await wallet.domainSeparator());
        });

        it("should calculate correctly the transaction hash", async () => {
            const { address, wallet } = await walletSetup(relayer);
            txMessage.to = address;
            const transactionHash = ethers.utils._TypedDataEncoder.hash(
                {
                    verifyingContract: wallet.address,
                    chainId: await wallet.getChainId()
                },
                types,
                txMessage
            );
            const _transactionHash = await wallet.getTransactionHash(
                txMessage.to,
                txMessage.value,
                txMessage.data,

                txMessage.nonce
            );
            expect(transactionHash).to.equal(_transactionHash);
        });

        it("should have correct chain id", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const { chainId } = await ethers.provider.getNetwork();
            expect(chainId).to.equal(await wallet.getChainId());
        });
    });

    describe("Special Owner", () => {
        it("should execute an EIP712 transaction", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.getThreshold()).to.equal(3);
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            safeTx.signature = await signTypedData(
                specialOwner,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            await execTx(wallet, safeTx);
            expect(await wallet.getThreshold()).to.equal(2);
        });

        it("should execute a transaction by signing the transaction hash", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.getThreshold()).to.equal(3);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);
            await execTx(wallet, safeTx);
            expect(await wallet.getThreshold()).to.equal(2);
        });

        it("should fail by signing an incorrect hash", async () => {
            const { address, wallet } = await walletSetup(relayer);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            const hash = await wallet.getTransactionHash(
                specialOwner.address, // incoherent value.
                safeTx.value,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);
            await expect(
                execTx(wallet.connect(_owner2), safeTx)
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail if 'v' is incorrect", async () => {
            const { address, wallet } = await walletSetup(relayer);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            safeTx.signature = paddedSignature(specialOwner.address);
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
        });

        it("should fail by signing with incorrect chainId", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.getThreshold()).to.equal(3);
            domain.chainId = 12;
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            safeTx.signature = await signTypedData(
                specialOwner,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail by signing with incorrect domain address", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.getThreshold()).to.equal(3);
            domain.verifyingContract = specialOwner.address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            safeTx.signature = await signTypedData(
                specialOwner,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail by signing with incorrect nonce EIP712", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.getThreshold()).to.equal(3);
            domain.verifyingContract = specialOwner.address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            safeTx.signature = await signTypedData(
                specialOwner,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data,
                1 //incorrect nonce
            );
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail by signing with incorrect nonce (regular hash)", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.getThreshold()).to.equal(3);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                1 // incorrect
            );
            safeTx.signature = await sign(specialOwner, hash);
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail if signature is too short", async () => {
            const { address, wallet } = await walletSetup(relayer);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            safeTx.signature =
                "0x000000000000000000000070997970C51812dc3A010C7d01b50e0d17dc79C8000000000000000000000000000000000000000000000000000000000000000001";
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith("SD: Invalid signature length");
        });

        it("should fail by trying to replay a signature", async () => {
            const { address, wallet } = await walletSetup(relayer);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);

            for (let i = 0; i < 10; i++) {
                // The first transaction should work.
                if (i === 0) {
                    await execTx(wallet, safeTx);
                    expect(await wallet.getThreshold()).to.equal(2);
                } else {
                    await expect(
                        wallet.execTransaction(
                            safeTx.to,
                            safeTx.value,
                            safeTx.data,
                            safeTx.signature
                        )
                    ).to.be.revertedWith(
                        "LW: Incorrect signature length || Incorrect Special Owner signature"
                    );
                }
            }
        });

        it("nonce should be updated after transaction", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.nonce()).to.equal(0);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);
            await execTx(wallet, safeTx);
            expect(await wallet.nonce()).to.equal(1);
        });

        it("nonce should not be updated on a failed transaction", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.nonce()).to.equal(0);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                1
            );
            safeTx.signature = await sign(specialOwner, hash);
            await expect(execTx(wallet, safeTx)).to.be.reverted;
            expect(await wallet.nonce()).to.equal(0);
        });
    });

    describe("Owners", () => {
        it("single owner should execute an EIP712 transaction", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                [owner1.address],
                [],
                1
            );
            const owners = await wallet.getOwners();
            expect(owners.length).to.equal(1);
            expect(owners[0]).to.equal(owner1.address);
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "addSpecialOwner", [
                specialOwner.address
            ]);
            safeTx.signature = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            await execTx(wallet, safeTx);
            expect((await wallet.getOwners()).length).to.equal(2);
            const specialOwners = await wallet.getSpecialOwners();
            expect(specialOwners.length).to.equal(1);
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(
                true
            );
        });

        it("single owner should execute a transaction by signing the transaction hash", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                [owner1.address],
                [],
                1
            );
            const owners = await wallet.getOwners();
            expect(owners.length).to.equal(1);
            expect(owners[0]).to.equal(owner1.address);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "addSpecialOwner", [
                specialOwner.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(owner1, hash);
            await execTx(wallet, safeTx);
            expect((await wallet.getOwners()).length).to.equal(2);
            const specialOwners = await wallet.getSpecialOwners();
            expect(specialOwners.length).to.equal(1);
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(
                true
            );
        });

        it("two owners should execute an EIP712 transaction", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                [owner1.address, owner2.address],
                [],
                2
            );
            expect(await wallet.getThreshold()).to.equal(2);
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [1]);
            const sig1 = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            const sig2 = await signTypedData(
                owner2,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            safeTx.signature = sig2 + sig1.slice(2);
            await execTx(wallet, safeTx);
            expect(await wallet.getThreshold()).to.equal(1);
        });

        it("should fail by sending the signatures unordered", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                [owner1.address, owner2.address],
                [],
                2
            );
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [1]);
            const sig1 = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            const sig2 = await signTypedData(
                owner2,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            safeTx.signature = sig1 + sig2.slice(2);
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith("LW: Invalid owner provided");
        });

        it("should fail by sending only one signature when the threshold is 2", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                [owner1.address, owner2.address],
                [],
                2
            );
            expect(await wallet.getThreshold()).to.equal(2);
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [1]);
            safeTx.signature = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail by sending a signature not belonging to an owner when the threshold is 1", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                [owner1.address, owner2.address],
                [],
                1
            );
            expect(await wallet.getThreshold()).to.equal(1);
            const randy = ethers.Wallet.createRandom();
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "addSpecialOwner", [
                specialOwner.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(randy, hash);
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith("LW: Invalid owner provided");
        });

        it("3 owners should execute an EIP712 transaction", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const randy = ethers.Wallet.createRandom();
            await relayer.sendTransaction({ to: address, value: oneEth });
            expect(await ethers.provider.getBalance(address)).to.equal(oneEth);
            expect(await ethers.provider.getBalance(randy.address)).to.equal(0);
            domain.verifyingContract = address;
            safeTx.to = randy.address;
            safeTx.value = oneEth;
            safeTx.data = "0x";

            const sig1 = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            const sig2 = await signTypedData(
                owner2,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            const sig3 = await signTypedData(
                owner3,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            safeTx.signature = sig2 + sig1.slice(2) + sig3.slice(2);
            await execTx(wallet, safeTx);
            expect(await ethers.provider.getBalance(address)).to.equal(0);
            expect(await ethers.provider.getBalance(randy.address)).to.equal(
                oneEth
            );
        });

        it("should fail if an owner repeats signatures multiple times", async () => {
            const { address, wallet } = await walletSetup(relayer);
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);

            const sig1 = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );

            const sig2 = await sign(owner1, hash);
            const sigs = sig1 + sig2.slice(2) + sig2.slice(2);
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    sigs
                )
            ).to.be.revertedWith("'LW: Invalid owner provided'");
        });

        it("should execute a transaction with different signatures schemes", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.getThreshold()).to.equal(3);
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);

            const sig1 = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            const sig2 = await signTypedData(
                owner2,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            const sig3 = await sign(owner3, hash);
            safeTx.signature = sig2 + sig1.slice(2) + sig3.slice(2);
            execTx(wallet, safeTx);
            expect(await wallet.getThreshold()).to.equal(3);
        });

        it("should fail by providing 2 signatures when the threshold is 3", async () => {
            const { address, wallet } = await walletSetup(relayer);
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);

            const sig1 = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            const sig2 = await signTypedData(
                owner2,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            safeTx.signature = sig2 + sig1.slice(2);

            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail if owners sign different data", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                [owner1.address, owner2.address],
                [],
                2
            );
            domain.verifyingContract = address;
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "changeThreshold", [2]);

            const sig1 = await signTypedData(
                owner1,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );
            domain.verifyingContract = ethers.Wallet.createRandom().address;
            const sig2 = await signTypedData(
                owner2,
                domain,
                safeTx.to,
                safeTx.value,
                safeTx.data
            );

            safeTx.signature = sig2 + sig1.slice(2);

            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.revertedWith("LW: Invalid owner provided");
        });
    });

    describe("EIP1271", () => {
        it("should return correct magic value by signing hash", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                [owner1.address],
                [],
                1
            );
            const magicValue = "0x1626ba7e";
            const owners = await wallet.getOwners();
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "addSpecialOwner", [
                specialOwner.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(owner1, hash);
            expect(
                await wallet.isValidSignature(hash, safeTx.signature)
            ).to.equal(magicValue);
        });

        it("should revert by providing an incorrect signature", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const owners = await wallet.getOwners();
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "addSpecialOwner", [
                specialOwner.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            const randy = ethers.Wallet.createRandom();
            safeTx.signature = await sign(randy, hash);
            await expect(
                wallet.isValidSignature(hash, safeTx.signature)
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });
    });
});
