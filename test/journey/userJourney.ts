import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer, Wallet } from "ethers";

import { encodeFunctionData, addressZero, SENTINEL, signMessage, fakeSignature, paddedSignature} from "../utils";
import { Domain, types, TxMessage, SafeTx } from "../types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");


// This is a basic test that mirrors a journey of 2 users (alice and bob).
// They sign the transactions with the eip712 signature so they can see what they are signing...
describe("User Journey", () => {
    let alice: Wallet;
    let bob: Wallet;
    let owner2: Wallet;
    let owner3: Wallet;
    let aliceAddress: string;
    let bobAddress: string;
    let owner2Address: string;
    let owner3Address: string;
    let relayer: Signer;
    let aliceWallet: Contract;
    let bobWallet: Contract;
    let aliceThreshold: number;
    let bobThreshold: number;
    let safeTx: SafeTx;
    let aliceDomain: Domain;
    let bobDomain: Domain;
    let txMessage: TxMessage;

    beforeEach(async () => {
        // signers
        alice = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        bob = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        owner2 = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
        owner3 = new ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
        aliceAddress = await alice.getAddress();
        bobAddress = await bob.getAddress();
        owner2Address = await owner2.getAddress();
        owner3Address = await owner3.getAddress();
        [relayer] = await ethers.getSigners();

        const LaserWallet = await ethers.getContractFactory("LaserWallet");
        // Deploying the base contract (implementation contract). To delegate all calls.
        const singleton = await LaserWallet.deploy();

        // proxy factory
        const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
        // Deploying the proxy factory to create proxies.
        const proxyFactory = await ProxyFactory.deploy();


        const aliceOwners = [aliceAddress, owner2Address, owner3Address];
        const bobOwners = [bobAddress, owner2Address, owner3Address];
        aliceThreshold = 2;
        bobThreshold = 3;
        // Initializer data to be sent with the proxy creation.
        // PROXY CREATION (ALICE) ////////////
        const aliceData = encodeFunctionData(abi, "setup", [aliceOwners, [aliceAddress], aliceThreshold, SENTINEL]);
        const aliceTx = await proxyFactory.createProxyWithNonce(singleton.address, aliceData, 1111);
        const aliceReceipt = await aliceTx.wait();
        const aliceWalletAddress = aliceReceipt.events[1].args.proxy;
        aliceWallet = new ethers.Contract(aliceWalletAddress, abi, relayer);
        /////////////////////////////////////////
        // PROXY CREATION (BOB) ///////////////////
        const bobData = encodeFunctionData(abi, "setup", [bobOwners, [bobAddress], bobThreshold, SENTINEL]);
        const bobTx = await proxyFactory.createProxyWithNonce(singleton.address, bobData, 1231231123);
        const bobReceipt = await bobTx.wait();
        const bobWalletAddress = bobReceipt.events[1].args.proxy;
        bobWallet = new ethers.Contract(bobWalletAddress, abi, relayer);
        ////////////////////////////////////////////////////
        safeTx = {
            to: "",
            value: "",
            data: "",
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: addressZero,
            refundReceiver: addressZero,
            signature : "",
            specialOwner : ""
        }
        aliceDomain = {
            chainId: await aliceWallet.getChainId(),
            verifyingContract: aliceWallet.address
        }
        bobDomain = {
            chainId: await bobWallet.getChainId(),
            verifyingContract: bobWallet.address
        }
        txMessage = {
            to: "",
            value: 0,
            data: "",
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: addressZero,
            refundReceiver: addressZero,
            nonce: ""
        }
    });

    describe("Correct setup", () => {
        it("alice wallet should have correct threshold", async () => {
            const threshold = await aliceWallet.getThreshold();
            expect(threshold).to.equal(aliceThreshold);
        });
        it("bob wallet should have correct threshold", async () => {
            const threshold = await bobWallet.getThreshold();
            expect(threshold).to.equal(bobThreshold);
        });
        it("alice wallet should have correct owners", async () => {
            expect(await aliceWallet.isOwner(aliceAddress)).to.equal(true);
            expect(await aliceWallet.isOwner(owner2Address)).to.equal(true);
            expect(await aliceWallet.isOwner(owner3Address)).to.equal(true);
            expect(await aliceWallet.isSpecialOwner(aliceAddress)).to.equal(true);
        });
        it("bob wallet should have correct owners", async () => {
            expect(await bobWallet.isOwner(bobAddress)).to.equal(true);
            expect(await bobWallet.isOwner(owner2Address)).to.equal(true);
            expect(await bobWallet.isOwner(owner3Address)).to.equal(true);
            expect(await bobWallet.isSpecialOwner(bobAddress)).to.equal(true);
        });
    }); 

    describe("Internal transactions", async () => {
        it("alice should remove owner3", async () => {
            expect(await aliceWallet.isOwner(owner3Address)).to.equal(true);
            // transaction data
            const txData = encodeFunctionData(abi, "removeOwner", [owner2Address, owner3Address, aliceThreshold]);

            // creating the message to sign
            txMessage.to = aliceWallet.address;
            txMessage.data = txData;
            txMessage.nonce = await aliceWallet.nonce();

            // signing the transaction eip712 compliant
            const txSignature = await alice._signTypedData(aliceDomain, types, txMessage);

            // generating the transaction
            safeTx.to = aliceWallet.address;
            safeTx.value = 0;
            safeTx.data = txData;
            safeTx.signature = txSignature;
            safeTx.specialOwner = aliceAddress;

            // executing the transaction
            await expect(aliceWallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(aliceWallet, "ExecutionSuccess");
            expect(await aliceWallet.isOwner(owner3Address)).to.equal(false);
        });
        it("bob should remove himself as an owner", async () => {
            const initialLength = (await bobWallet.getOwners()).length;
            expect(await bobWallet.isOwner(bobAddress)).to.equal(true);
            expect(await bobWallet.isSpecialOwner(bobAddress)).to.equal(true);
            const _threshold = initialLength - 1; //we need to lower the threshold so it does not exceed the number of owners.
            const txData = encodeFunctionData(abi, "removeOwner", [SENTINEL, bobAddress, _threshold]);
            txMessage.to = bobWallet.address;
            txMessage.data = txData;
            txMessage.nonce = await bobWallet.nonce();
            const txSignature = await bob._signTypedData(bobDomain, types, txMessage);
            safeTx.to = bobWallet.address;
            safeTx.value = 0;
            safeTx.data = txData;
            safeTx.signature = txSignature;
            safeTx.specialOwner = bobAddress;
            await expect(bobWallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(bobWallet, "ExecutionSuccess");
            const postLength = (await bobWallet.getOwners()).length;
            expect(initialLength - postLength).to.equal(1);
            expect(await bobWallet.isOwner(bobAddress)).to.equal(false);
            expect(await bobWallet.isSpecialOwner(bobAddress)).to.equal(false);
        });
        it("alice should update the threshold", async () => {
            const initialThreshold = 2;
            // we want to change the threhold to 3
            const targetThreshold = 3;
            let _threshold = await aliceWallet.getThreshold();
            expect(_threshold).to.equal(initialThreshold);
            const txData = encodeFunctionData(abi, "changeThreshold", [targetThreshold]);
            txMessage.to = aliceWallet.address;
            txMessage.data = txData;
            txMessage.nonce = await aliceWallet.nonce();
            const txSignature = await alice._signTypedData(aliceDomain, types, txMessage);
            safeTx.to = aliceWallet.address;
            safeTx.value = 0;
            safeTx.data = txData;
            safeTx.signature = txSignature;
            safeTx.specialOwner = aliceAddress;
            await expect(aliceWallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(aliceWallet, "ExecutionSuccess");
            _threshold = await aliceWallet.getThreshold();
            expect(_threshold).to.equal(targetThreshold);
        });
        it("bob should change the entry point address", async () => {
            const random = ethers.Wallet.createRandom();
            // entry point is at storage slot 1
            let _targetAddress = await ethers.provider.getStorageAt(bobWallet.address, 1);
            const currentEntryPoint = `0x${_targetAddress.slice(26)}`;
            expect(currentEntryPoint).to.equal(SENTINEL);
            const txData = encodeFunctionData(abi, "changeEntryPoint", [random.address]);
            txMessage.to = bobWallet.address;
            txMessage.data = txData;
            txMessage.nonce = await bobWallet.nonce();
            const txSignature = await bob._signTypedData(bobDomain, types, txMessage);
            safeTx.to = bobWallet.address;
            safeTx.value = 0;
            safeTx.data = txData;
            safeTx.signature = txSignature;
            safeTx.specialOwner = bobAddress;
            await expect(bobWallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(bobWallet, "ExecutionSuccess");
            _targetAddress = await ethers.provider.getStorageAt(bobWallet.address, 1);
            const newEntryPoint = `0x${_targetAddress.slice(26)}`;
            expect(newEntryPoint.toLowerCase()).to.equal(random.address.toLowerCase());
        });
    });

    describe("Value transfer (external transactions)", () => {
        let fundingValue: BigNumber;

        beforeEach(async () => {
            fundingValue = ethers.utils.parseEther("100");
            // we are funding both wallets.
            await relayer.sendTransaction({
                to: aliceWallet.address,
                value: fundingValue
            });
            await relayer.sendTransaction({
                to: bobWallet.address,
                value: fundingValue
            });
        });

        describe("Wallets funded", () => {
            it("alice wallet should have eth", async () => {
                const balance = await ethers.provider.getBalance(aliceWallet.address);
                expect(balance).to.equal(fundingValue);
            });
            it("bob wallet should have eth", async () => {
                const balance = await ethers.provider.getBalance(bobWallet.address);
                expect(balance).to.equal(fundingValue);
            });
        });

        describe("Transactions", () => {
            it("alice should be able to send herself some eth", async () => {
                const amount = ethers.utils.parseEther("50");
                const aliceInitialBalance = await ethers.provider.getBalance(aliceAddress);

                // creating the message to sign
                txMessage.to = aliceAddress;
                txMessage.value = amount;
                txMessage.data = "0x";
                txMessage.nonce = await aliceWallet.nonce();

                // signing the transaction eip712 compliant
                const txSignature = await alice._signTypedData(aliceDomain, types, txMessage);

                // generating the transaction
                safeTx.to = aliceAddress;
                safeTx.value = amount;
                safeTx.data = "0x";
                safeTx.signature = txSignature;
                safeTx.specialOwner = aliceAddress;

                // executing the transaction
                await expect(aliceWallet.execTransaction(
                    safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                    safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
                )).to.emit(aliceWallet, "ExecutionSuccess");

                const alicePostBalance = await ethers.provider.getBalance(aliceAddress);
                expect(Math.trunc(Number(alicePostBalance))).to.be.greaterThan(Math.trunc(Number(aliceInitialBalance)));
            });
        });
    })
});