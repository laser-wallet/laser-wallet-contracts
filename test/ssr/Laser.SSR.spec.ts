import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
    walletSetup,
    factorySetup,
    encodeFunctionData,
    sign,
    signTypedData,
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
    await from.sendTransaction({
        to: to,
        value: amount,
    });
}

describe("Sovereign Social Recovery", () => {
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

    describe("Recovery Owners", () => {
        it("should fail by providing one recovery owner", async () => {});

        it("guardian should be able to lock the wallet ", async () => {});

        it("owner should not be able to lock the wallet 'handleOps' ", async () => {});

        it("recovery owner should not be able to lock the wallet 'handleOps' ", async () => {});
    });
});
