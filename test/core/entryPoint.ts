import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer, Wallet } from "ethers";

import { encodeFunctionData, addressZero, SENTINEL, signMessage, fakeSignature, paddedSignature} from "../utils";
import { Domain, types, TxMessage, SafeTx, UserOp } from "../types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");


describe("EntryPoint", () => {
    let specialOwner: Wallet;
    let owner2: Wallet;
    let owner3: Wallet;
    let owner4: Wallet;
    let relayer: Signer;
    let wallet: Contract;
    let EntryPoint: Contract;
    let EntryPointAddress: string;
    let threshold: number;
    let owners: string[];
    let specialOwners: string[];
    let domain: Domain;
    let txMessage: TxMessage;
    let safeTx: SafeTx;
    let userOp: UserOp;
    let fundingAmount: BigNumber;

    beforeEach(async () => {
          // In order to sign typed data, we need to use Wallet instead of signers. 
        // The accounts are the first 4 deterministic accounts of Harhdat
        specialOwner = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        owner2 = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        owner3 = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
        owner4 = new ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
        threshold = 2;
        const LaserWallet = await ethers.getContractFactory("LaserWallet");
        const singleton = await LaserWallet.deploy();
        const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
        const proxyFactory = await ProxyFactory.deploy();
        owners = [specialOwner.address, owner2.address, owner3.address, owner4.address];
        specialOwners = [specialOwner.address];
        const _EntryPoint = await ethers.getContractFactory("TestEntryPoint");
        EntryPoint = await _EntryPoint.deploy(SENTINEL, 0, 0);
        EntryPointAddress = EntryPoint.address;
        const data = encodeFunctionData(abi, "setup", [owners, specialOwners, threshold, EntryPointAddress]);
        const transaction = await proxyFactory.createProxyWithNonce(singleton.address, data, 1111);
        const receipt = await transaction.wait();
        const walletAddress = receipt.events[1].args.proxy;
        [relayer] = await ethers.getSigners();
        wallet = new ethers.Contract(walletAddress, abi, relayer);
        domain = {
            chainId: await wallet.getChainId(),
            verifyingContract: wallet.address
        }
        safeTx = {
            to: wallet.address,
            value: 0,
            data: "",
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: addressZero,
            refundReceiver: addressZero,
            signature : "",
            specialOwner : specialOwner.address
        }
        txMessage = {
            to: wallet.address,
            value: 0,
            data: "0x",
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: addressZero,
            refundReceiver: addressZero,
            nonce: 0
        }
        userOp = {
            sender: wallet.address,
            nonce: 0,
            initCode: "0x",
            callData: "",
            callGas: 2100000,
            verificationGas: 2100000,
            preVerificationGas: 2000000,
            maxFeePerGas: 2100000000,
            maxPriorityFeePerGas: 2100000000,
            paymaster: ethers.constants.AddressZero,
            paymasterData: "0x",
            signature: "0x"
        }
        // funding the wallet
        fundingAmount = ethers.utils.parseEther("100");
        await relayer.sendTransaction({to: wallet.address, value: fundingAmount});
    });

    describe("Correct setup", () => {
        it("should have correct threshold", async () => {
            const _threshold = await wallet.getThreshold();
            expect(_threshold).to.equal(threshold);
        });
        it("should have correct owners and special owners", async () => {
            const _owners = await wallet.getOwners();
            expect(_owners.length).to.equal(owners.length);
            expect(await wallet.isOwner(specialOwner.address)).to.equal(true);
            expect(await wallet.isOwner(owner2.address)).to.equal(true);
            expect(await wallet.isOwner(owner3.address)).to.equal(true);
            expect(await wallet.isOwner(owner4.address)).to.equal(true);
            const _specialOwners = await wallet.getSpecialOwners();
            expect(_specialOwners.length).to.equal(specialOwners.length);
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(true);
        });
        it("should not allow to call setup()", async () => {
            await expect(wallet.setup(owners, specialOwners, threshold, SENTINEL)).to.be.revertedWith("'Wallet already initialized");
        });
        it("should have eth", async () => {
            const balance = await ethers.provider.getBalance(wallet.address);
            expect(balance).to.equal(fundingAmount);
        });
    });

    describe("validateUserOp() 'handleOp'", () => {
        it("should only accept calls from the entry point", async () => {
            const fkBytes = "0xb00e65f7e6801b0a78eb54b58b48a2b831b8e25c08de88918ac71d5214e9c4ee";
            userOp.callData = "0x";
            await expect(wallet.validateUserOp(userOp, fkBytes, 0)).to.be.revertedWith("Not Entry Point");
        });
        it("should fail due calling the function directly", async () => {
            const _data = encodeFunctionData(abi, "changeThreshold", [2]);
            userOp.callData = _data;
            await expect(EntryPoint.handleOp(userOp, wallet.address)).to.be.reverted;
        });
        it("should fail by providing invalid signature", async () => {
            const _data = encodeFunctionData(abi, "changeThreshold", [1]);
            txMessage.data = _data;
            // not the special owner
            const sig = await owner2._signTypedData(domain, types, txMessage);
            const calldata = encodeFunctionData(abi, "execTransaction", [
                wallet.address, 0, _data, 0, 0, 0, 0, addressZero, addressZero, 
                sig, specialOwner.address
            ]);
            userOp.callData = calldata;
            await expect(EntryPoint.handleOp(userOp, wallet.address)).to.be.reverted;
        });
        it("should change the threshold and pay for the transaction", async () => {
            const initialBalance = await ethers.provider.getBalance(wallet.address);
            expect(await wallet.getThreshold()).to.equal(2);
            // changing the threshold to 1
            const _data = encodeFunctionData(abi, "changeThreshold", [1]);
            txMessage.data = _data;
            const sig = await specialOwner._signTypedData(domain, types, txMessage);
            const calldata = encodeFunctionData(abi, "execTransaction", [
                wallet.address, 0, _data, 0, 0, 0, 0, addressZero, addressZero, 
                sig, specialOwner.address
            ]);
            userOp.callData = calldata;
            await EntryPoint.handleOp(userOp, wallet.address);
            expect(await wallet.getThreshold()).to.equal(1);
            const postBalance = await ethers.provider.getBalance(wallet.address);
            expect(Math.trunc(Number(initialBalance))).to.be.greaterThan(Math.trunc(Number(postBalance)));
        });
    });

    describe("handleOps()", () => {
        let op1: UserOp;
        let op2: UserOp;
        let op3: UserOp;

        beforeEach(async () => {
            op1 = {
                sender: wallet.address,
                nonce: 0,
                initCode: "0x",
                callData: "",
                callGas: 2100000,
                verificationGas: 2100000,
                preVerificationGas: 2000000,
                maxFeePerGas: 2100000000,
                maxPriorityFeePerGas: 2100000000,
                paymaster: ethers.constants.AddressZero,
                paymasterData: "0x",
                signature: "0x"
            }
            op2 = {
                sender: wallet.address,
                nonce: 0,
                initCode: "0x",
                callData: "",
                callGas: 2100000,
                verificationGas: 2100000,
                preVerificationGas: 2000000,
                maxFeePerGas: 2100000000,
                maxPriorityFeePerGas: 2100000000,
                paymaster: ethers.constants.AddressZero,
                paymasterData: "0x",
                signature: "0x"
            }
            op3 = {
                sender: wallet.address,
                nonce: 0,
                initCode: "0x",
                callData: "0x",
                callGas: 2100000,
                verificationGas: 2100000,
                preVerificationGas: 2000000,
                maxFeePerGas: 2100000000,
                maxPriorityFeePerGas: 2100000000,
                paymaster: ethers.constants.AddressZero,
                paymasterData: "0x",
                signature: "0x"
            }
        });

        it("should send multiple user ops", async () => {
            const initialBalance = await ethers.provider.getBalance(wallet.address);
            // sending 90 eth to specialOwner
            txMessage.data = "0x";
            txMessage.value = ethers.utils.parseEther("90");
            txMessage.to = specialOwner.address;
            const sig1 = await specialOwner._signTypedData(domain, types, txMessage);
            op1.callData = encodeFunctionData(abi, "execTransaction", [
                specialOwner.address, ethers.utils.parseEther("90"), "0x", 0, 0, 0, 0,
                addressZero, addressZero, sig1, specialOwner.address
            ]);

            //changing the threshold
            expect(await wallet.getThreshold()).to.equal(2);
            const _data = encodeFunctionData(abi, "changeThreshold", [1]);
            txMessage.data = _data;
            txMessage.to = wallet.address;
            txMessage.value = 0;
            txMessage.nonce = 1; // we need to increase the nonce.
            const sig2 = await specialOwner._signTypedData(domain, types, txMessage);
            op2.callData = encodeFunctionData(abi, "execTransaction", [
                wallet.address, 0, _data, 0, 0, 0, 0, addressZero, addressZero, 
                sig2, specialOwner.address
            ]);

            // removing the special owner
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(true); // check.
            const _data3 = encodeFunctionData(abi, "removeSpecialOwner", [specialOwner.address]);
            txMessage.data = _data3;
            txMessage.nonce = 2; // we need to increase the nonce.
            const sig3 = await specialOwner._signTypedData(domain, types, txMessage);
            op3.callData = encodeFunctionData(abi, "execTransaction", [
                wallet.address, 0, _data3, 0, 0, 0, 0, addressZero, addressZero, 
                sig3, specialOwner.address
            ]);

            const ops = [op1, op2, op3];
            await EntryPoint.handleOps(ops, wallet.address);
            //check results.
            const postBalance = await ethers.provider.getBalance(wallet.address);
            expect(Math.trunc(Number(initialBalance))).to.be.greaterThan(Math.trunc(Number(postBalance)));
            expect(await wallet.getThreshold()).to.equal(1); 
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(false); 
        });
    });
});