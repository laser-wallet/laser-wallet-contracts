import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import { walletSetup } from "../utils";

const oneEth = ethers.utils.parseEther("1");

const mock = Wallet.createRandom().address;
const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Receive", () => {
    let owner: Signer;
    let ownerAddress: string;
    let guardians: string[];
    let entryPoint: string;
    let _guardian1: Signer;
    let _guardian2: Signer;

    beforeEach(async () => {
        [owner, _guardian1, _guardian2] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        guardians = [await _guardian1.getAddress(), await _guardian2.getAddress()];
        const EP = await ethers.getContractFactory("TestEntryPoint");
        const _entryPoint = await EP.deploy(mock, 0, 0);
        entryPoint = _entryPoint.address;
    });

    describe("receive", () => {
        it("should be able to receive eth via send transaction", async () => {
            const { address, wallet } = await walletSetup(ownerAddress, guardians, entryPoint);
            expect(
                await owner.sendTransaction({
                    to: wallet.address,
                    value: oneEth,
                })
            )
                .to.emit(wallet, "SafeReceived")
                .withArgs(ownerAddress, oneEth);
            const balance = await ethers.provider.getBalance(wallet.address);
            expect(balance).to.equal(oneEth);
        });

        it("should be able to receive eth via a contract call", async () => {
            const { address, wallet } = await walletSetup(ownerAddress, guardians, entryPoint);
            const initialBalance = await ethers.provider.getBalance(wallet.address);
            expect(initialBalance).to.equal(0);
            const factoryCaller = await ethers.getContractFactory("Caller");
            const caller = await factoryCaller.deploy();
            // Funding the caller.
            await owner.sendTransaction({
                to: caller.address,
                value: oneEth,
            });
            // Executing the transaction from the caller.
            await caller._call(address, oneEth, "0x");
            const postBalance = await ethers.provider.getBalance(wallet.address);
            expect(postBalance).to.equal(oneEth);
        });
    });
});
