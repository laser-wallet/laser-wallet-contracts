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

describe("Signatures", () => {
    let addresses: AddressesForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("Signatures", async () => {
        it("owner should execute a transaction by signing the hash", async () => {});

        it("owner should execute a transaction by signing typed data", async () => {});

        it("transaction should fail by hash miss-match", async () => {});

        it("transaction should fail by signing wrong types", async () => {});
    });
});
