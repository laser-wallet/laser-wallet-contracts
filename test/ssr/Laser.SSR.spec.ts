import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
    walletSetup,
    factorySetup,
    encodeFunctionData,
    sign,
    signTypedData
} from "../utils";
import { types, Address, Numberish } from "../types";
import {
    ownerWallet,
    recoveryOwnerWallet,
    guardianWallet,
    tenEth,
    twoEth,
} from "../constants/constants";

const mock = ethers.Wallet.createRandom().address;
const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

// Sends 10 eth...
async function fund(to: Address, from: Signer): Promise<void> {
    const amount = tenEth;
    await from.sendTransaction({ to: to, value: amount });
}

describe("Sovereign Social Recovery", () => {
    let owner: Signer;
    let ownerAddress: Address;
    let recoveryOwner: Signer;
    let recoveryOwnerAddr: Address;
    let guardians: Address[];
    let _guardian1: Signer;
    let _guardian2: Signer;
    let relayer: Signer;

    beforeEach(async () => {
        [owner, recoveryOwner, _guardian1, _guardian2, relayer] =
            await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwnerAddr = await recoveryOwner.getAddress();
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress(),
        ];
    });

    describe("Basic init", () => {
        it("correct setup", async () => {
           const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians
            );
            const owner = await wallet.owner();
            const recoveryOwner = await wallet.recoveryOwner();
            expect(owner).to.equal(ownerWallet.address);
            expect(recoveryOwner).to.equal(recoveryOwnerWallet.address);
            expect(await wallet.isGuardian(guardianWallet.address)).to.equal(
                true
            );
        });
    });

    describe("lock()", () => {
        it("should not allow to call the function directly", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians
            );
            await expect(wallet.lock()).to.be.revertedWith(
                "SelfAuthorized__notWallet()"
            );
        });

        it("guardian should be able to lock the wallet ", async () => {

        });

        it("owner should not be able to lock the wallet 'handleOps' ", async () => {
        });

        it("recovery owner should not be able to lock the wallet 'handleOps' ", async () => {
        });
    });
});
