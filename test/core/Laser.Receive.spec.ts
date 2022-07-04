import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import { walletSetup } from "../utils";
import { Address } from "../types";

const oneEth = ethers.utils.parseEther("1");

describe("Receive", () => {
    let owner: Signer;
    let ownerAddress: Address;
    let recoveryOwner1: Signer;
    let recoveryOwner2: Signer;
    let guardians: Address[];
    let _guardian1: Signer;
    let _guardian2: Signer;
    let relayer: Signer;
    let recoveryOwners: Address[];

    beforeEach(async () => {
        [
            owner,
            recoveryOwner1,
            recoveryOwner2,
            _guardian1,
            _guardian2,
            relayer,
        ] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwners = [
            await recoveryOwner1.getAddress(),
            await recoveryOwner2.getAddress(),
        ];
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress(),
        ];
    });

    describe("receive", () => {
        it("should be able to receive eth via send transaction", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
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
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const initialBalance = await ethers.provider.getBalance(
                wallet.address
            );
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
            const postBalance = await ethers.provider.getBalance(
                wallet.address
            );
            expect(postBalance).to.equal(oneEth);
        });
    });
});
