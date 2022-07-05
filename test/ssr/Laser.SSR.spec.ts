import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
    walletSetup,
    sign,
    signTypedData,
    generateTransaction,
    addressesForTest,
    signersForTest,
    AddressesForTest,
} from "../utils";
import { Address, Domain } from "../types";
import { ownerWallet } from "../constants/constants";

describe("Sovereign Social Recovery", () => {
    let addresses: AddressesForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("Recovery Owners", () => {
        it("should fail by providing one recovery owner", async () => {});

        it("guardian should be able to lock the wallet ", async () => {});

        it("owner should not be able to lock the wallet 'handleOps' ", async () => {});

        it("recovery owner should not be able to lock the wallet 'handleOps' ", async () => {});
    });

    describe("Guardians", () => {});
});
