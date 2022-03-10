import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer, Wallet } from "ethers";

import { encodeFunctionData, addressZero, SENTINEL, signMessage, fakeSignature, paddedSignature} from "../utils";
import { Domain, types, TxMessage, SafeTx } from "../types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");


describe("Fallback", () => {
    let sender: Signer;
    let wallet: Contract;
    let fundingAmount: BigNumber;
    let signature: string;
    let owner1: Signer;
    let owner2: Signer;

    beforeEach(async () => {
        const LaserWallet = await ethers.getContractFactory("LaserWallet");
        const singleton = await LaserWallet.deploy();
        const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
        const proxyFactory = await ProxyFactory.deploy();
        [ sender ] = await ethers.getSigners();
        [owner1, owner2] = await ethers.getSigners();
        const owners = [await owner1.getAddress(), await owner2.getAddress()];
        const specialOwners = [await owner1.getAddress(), await owner2.getAddress()];
        const data = encodeFunctionData(abi, "setup", [owners, specialOwners, 1, SENTINEL]);
        const transaction = await proxyFactory.createProxyWithNonce(singleton.address, data, 1111);
        const receipt = await transaction.wait();
        const walletAddress = receipt.events[1].args.proxy;
        wallet = new ethers.Contract(walletAddress, abi, sender);
        signature = paddedSignature(await owner1.getAddress());
    });

    describe("Correct setup", () => {
        it("should have the correct threshold", async () => {
            const threshold = await wallet.getThreshold();
            expect(threshold.toString()).to.equal("1");
        });
        it("wallet should have 0 eth", async () => {
            const balance = await ethers.provider.getBalance(wallet.address);
            expect(balance).to.equal(0);
        });
    });

    describe("receive", () => {
        it("should be able to receive eth via send transaction", async () => {
            const amount = ethers.utils.parseEther("1");
           expect (await sender.sendTransaction({
                to: wallet.address,
                value: amount
            })).to.emit(wallet, "SafeReceived").withArgs(await sender.getAddress(), amount);
            const balance = await ethers.provider.getBalance(wallet.address);
            expect(balance).to.equal(amount);
        });
    });

    describe("calldata calls", () => {
        it("should change the threshold through a calldata call", async () => {
            const initialThreshold = await wallet.getThreshold();
            expect(initialThreshold.toString()).to.equal("1");
            const thresholdData = encodeFunctionData(abi, "changeThreshold", [2]);
            const calldata = encodeFunctionData(abi, "execTransaction", [
                wallet.address, 0, thresholdData, 0, 0, 0, 0, addressZero, addressZero, signature, addressZero
            ]);
            await sender.sendTransaction({to: wallet.address, data: calldata});
            const postThreshold = await wallet.getThreshold();
            expect(postThreshold.toString()).to.equal("2");
        });
        it("should remove a special owner through a calldata call", async () => {
            expect(await wallet.isSpecialOwner(await owner2.getAddress())).to.equal(true);
            const removeSpecialOwnerData = encodeFunctionData(abi, "removeSpecialOwner", [await owner2.getAddress()]);
            const calldata = encodeFunctionData(abi, "execTransaction", [
                wallet.address, 0, removeSpecialOwnerData, 0, 0, 0, 0, addressZero, addressZero, signature, addressZero
            ]);
            await sender.sendTransaction({to: wallet.address, data: calldata});
            expect(await wallet.isSpecialOwner(await owner2.getAddress())).to.equal(false);
        });
    });
});