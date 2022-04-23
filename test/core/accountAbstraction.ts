import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, providers, Signer, Wallet } from "ethers";

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
    safeTx,
    oneEth,
    guardian,
    encodeCallData,
    OWNERS,
    SPECIAL_OWNERS,
    THRESHOLD
} from "../utils";
import {
    SafeTx,
    Domain,
    LaserOp,
    UserOp,
    laserOp,
    userOp,
    userOpTypes
} from "../types";
import { signTypedData, sign, entryPointTypedSig } from "../utils/sign";

const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

async function fund(address: string, signer: Signer) {
    await signer.sendTransaction({ to: address, value: oneEth });
}

describe("Account Abstraction", () => {
    let relayer: Signer;
    let EntryPoint: Contract;
    let addr: string;
    let domain: Domain;
    let mockData: string;

    beforeEach(async () => {
        [relayer] = await ethers.getSigners();
        const ENTRY_POINT = await ethers.getContractFactory("TestEntryPoint");
        EntryPoint = await ENTRY_POINT.deploy(SENTINEL, 0, 0);
        addr = EntryPoint.address;
        const { address, wallet } = await walletSetup(relayer);
        domain = {
            chainId: await wallet.getChainId(),
            verifyingContract: ""
        };
        // This values are for simple testing, they can be overwritten.
        userOp.callGas = 200000;
        userOp.verificationGas = 100000;
        userOp.preVerificationGas = 100000;
        userOp.maxFeePerGas = 1100000000;
        userOp.maxPriorityFeePerGas = 1100000000;
        userOp.nonce = 0;
        userOp.signature = "0x";
        mockData = encodeFunctionData(abi, "changeThreshold", [2]);
    });

    describe("Correct setup", async () => {
        it("Init", async () => {
            const { address, wallet } = await walletSetup(relayer);
            await guardian(address);
        });
    });

    describe("validateUserOp() 'handleOp'", () => {
        it("should only accept calls from the entry point", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const fkBytes =
                "0xb00e65f7e6801b0a78eb54b58b48a2b831b8e25c08de88918ac71d5214e9c4ee";
            userOp.sender = wallet.address;
            userOp.nonce = 0;
            userOp.callData = "0x";
            userOp.signature = "0x";
            await expect(
                wallet.validateUserOp(userOp, fkBytes, 0)
            ).to.be.revertedWith("EP: Not Entry Point");
        });

        it("should revert by calling the function directly from EntryPoint", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const data = encodeFunctionData(abi, "changeThreshold", [2]);
            userOp.sender = address;
            userOp.nonce = 0;
            userOp.callData = data;
            userOp.signature = paddedSignature(specialOwner.address);
            await expect(EntryPoint.handleOp(userOp, address)).to.be.reverted;
        });
    });

    describe("Correct data", () => {
        it("should have correct domain separator", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain({
                verifyingContract: address,
                chainId: await wallet.getChainId()
            });
            expect(domainSeparator).to.equal(await wallet._domainSeparator());
        });

        it("should calculate correctly the transaction hash", async () => {
            const { address, wallet } = await walletSetup(relayer);
            userOp.sender = address;
            userOp.nonce = 0;
            userOp.callData = "0x";
            const transactionHash = ethers.utils._TypedDataEncoder.hash(
                {
                    verifyingContract: address,
                    chainId: await wallet.getChainId()
                },
                userOpTypes,
                userOp
            );
            const _transactionHash = await wallet.userOperationHash(userOp);
            expect(transactionHash).to.equal(_transactionHash);
        });
    });

    describe("Transactions", () => {
        it("should execute an EIP712 transaction", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            await fund(address, relayer);
            const value = 0;
            domain.verifyingContract = address;
            userOp.sender = address;
            userOp.callData = encodeCallData(userOp.sender, 0, mockData);
            userOp.signature = await entryPointTypedSig(
                specialOwner,
                domain,
                address,
                userOp.callData
            );
            await EntryPoint.handleOp(userOp, address);
            expect(await wallet.getThreshold()).to.equal(2);
        });

        it("should execute a transaction by signing the transaction hash", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            await fund(address, relayer);
            userOp.sender = address;
            userOp.callData = encodeCallData(userOp.sender, 0, mockData);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await EntryPoint.handleOp(userOp, address);
            expect(await wallet.getThreshold()).to.equal(2);
        });

        it("should fail by signing an incorrect hash", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            await fund(address, relayer);
            userOp.sender = owner1.address; // incoherent value.
            userOp.callData = encodeCallData(userOp.sender, 0, mockData);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            // refactor
            userOp.sender = address;
            await expect(
                EntryPoint.handleOp(userOp, address)
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail if 'v' is incorrect", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            await fund(address, relayer);
            userOp.sender = address;
            userOp.callData = encodeCallData(userOp.sender, 0, mockData);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = paddedSignature(specialOwner.address);
            await expect(
                EntryPoint.handleOp(userOp, address)
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail by signing with incorrect chainId", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            await fund(address, relayer);
            domain.chainId = 12;
            domain.verifyingContract = address;
            userOp.sender = address;
            userOp.callData = encodeCallData(userOp.sender, 0, mockData);
            userOp.signature = await entryPointTypedSig(
                specialOwner,
                domain,
                address,
                userOp.callData
            );
            await expect(
                EntryPoint.handleOp(userOp, address)
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });

        it("should fail by providing incorrect calldata", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            await fund(address, relayer);
            userOp.sender = address;
            userOp.callData = "0x11111111";
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await expect(
                EntryPoint.handleOp(userOp, address)
            ).to.be.revertedWith("LW-AA: incorrect callData");
        });

        it("should fail by signing with incorrect domain address", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            await fund(address, relayer);
            domain.chainId = await wallet.getChainId();
            domain.verifyingContract = (ethers.Wallet.createRandom()).address;
            userOp.sender = address; // incoherent value.
            userOp.callData = encodeCallData(userOp.sender, 0, mockData);
            userOp.signature = await entryPointTypedSig(
                specialOwner,
                domain,
                address,
                userOp.callData
            );
            await expect(
                EntryPoint.handleOp(userOp, address)
            ).to.be.revertedWith(
                "LW: Incorrect signature length || Incorrect Special Owner signature"
            );
        });
    });

    describe("Guard", () => {
        it("should revert if transaction exceeds spending limit", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr,
                oneEth
            );
            await fund(address, relayer);
            userOp.sender = address;
            userOp.callData = encodeCallData(address, oneEth.add(1), "0x");
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await expect(
                EntryPoint.handleOp(userOp, address)
            ).to.be.revertedWith("GUARD: Transaction exceeds limit");
        });

        it("should deactivate the module", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr,
                oneEth
            );
            await fund(address, relayer);
            userOp.sender = address;
            const data = encodeFunctionData(abi, "removeEthSpendingLimit", []);
            userOp.callData = encodeCallData(address, 0, data);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await EntryPoint.handleOp(userOp, address);
            expect(await wallet.ethSpendingLimit()).to.equal(0);
        });

        it("should update the Eth spending limit", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr,
                oneEth
            );
            const twoEth = ethers.utils.parseEther("2");
            expect(await wallet.ethSpendingLimit()).to.equal(oneEth);
            await fund(address, relayer);
            userOp.sender = address;
            const data = encodeFunctionData(abi, "updateEthSpendingLimit", [
                twoEth
            ]);
            userOp.callData = encodeCallData(address, 0, data);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await EntryPoint.handleOp(userOp, address);
            expect(await wallet.ethSpendingLimit()).to.equal(twoEth);
        });
    });

    describe("Migration", () => {
        it("should fail by providing an incorrect singleton address", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            const singleton = await wallet.singleton();
            await fund(address, relayer);
            const fakeSingleton = ethers.Wallet.createRandom();
            const data = encodeFunctionData(abi, "upgradeSingleton", [
                fakeSingleton.address
            ]);
            userOp.sender = address;
            userOp.callData = encodeCallData(userOp.sender, 0, data);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await EntryPoint.handleOp(userOp, address);
            expect(await wallet.singleton()).to.equal(singleton);
        });

        it("should fail by providing a contract without interface support", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            const NEW_SINGLETON = await ethers.getContractFactory(
                "IncorrectMigrate"
            );
            const newSingleton = await NEW_SINGLETON.deploy();
            const singleton = await wallet.singleton();
            await fund(address, relayer);
            const data = encodeFunctionData(abi, "upgradeSingleton", [
                newSingleton.address
            ]);
            userOp.sender = address;
            userOp.callData = encodeCallData(userOp.sender, 0, data);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await EntryPoint.handleOp(userOp, address);
            expect(await wallet.singleton()).to.equal(singleton);
        });

        it("should migrate to a new singleton", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            const NEW_SINGLETON = await ethers.getContractFactory(
                "TestMigrate"
            );
            const newSingleton = await NEW_SINGLETON.deploy();
            const singleton = await wallet.singleton();
            await fund(address, relayer);
            const data = encodeFunctionData(abi, "upgradeSingleton", [
                newSingleton.address
            ]);
            userOp.sender = address;
            userOp.callData = encodeCallData(userOp.sender, 0, data);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await EntryPoint.handleOp(userOp, address);
            expect(await wallet.singleton()).to.equal(newSingleton.address);
            const newAbi = [
                "function imNew() external view returns (string memory)"
            ];
            const newWallet = new ethers.Contract(address, newAbi, relayer);
            expect(await newWallet.imNew()).to.equal("New");
            await guardian(address);
        });
    });

    describe("Change Entry Point", () => {
        it("should revert by calling the function directly", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const randy = ethers.Wallet.createRandom();
            await expect(
                wallet.changeEntryPoint(randy.address)
            ).to.be.revertedWith("'SA: Only callable from the wallet'");
        });

        it("should fail by providing an incorrect entry point address", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const fakeSingleton = ethers.Wallet.createRandom();
            safeTx.to = address;
            safeTx.data = encodeFunctionData(abi, "changeEntryPoint", [
                fakeSingleton.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                0,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    safeTx.signature
                )
            ).to.be.reverted;
        });

        it("should update the entry point from execTransaction", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const newEntryPointFactory = await ethers.getContractFactory(
                "TestMigrate"
            );
            const newEntryPoint = await newEntryPointFactory.deploy();
            safeTx.to = address;
            safeTx.data = encodeFunctionData(abi, "changeEntryPoint", [
                newEntryPoint.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                0,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);
            await wallet.execTransaction(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                safeTx.signature
            );
            expect(await wallet.entryPoint()).to.equal(newEntryPoint.address);
        });

        it("should update the entry point from the handle op", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                OWNERS,
                SPECIAL_OWNERS,
                THRESHOLD,
                addr
            );
            const newEntryPointFactory = await ethers.getContractFactory(
                "TestMigrate"
            );
            const newEntryPoint = await newEntryPointFactory.deploy();
            await fund(address, relayer);
            const data = encodeFunctionData(abi, "changeEntryPoint", [
                newEntryPoint.address
            ]);
            userOp.sender = address;
            userOp.callData = encodeCallData(userOp.sender, 0, data);
            const hash = await wallet.userOperationHash(userOp);
            userOp.signature = await sign(specialOwner, hash);
            await EntryPoint.handleOp(userOp, address);
            expect(await wallet.entryPoint()).to.equal(newEntryPoint.address);
        });
    });
});
