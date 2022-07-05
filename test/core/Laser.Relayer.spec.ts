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

describe("Relayer", () => {
    let addresses: AddressesForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("Gas costs", () => {
        it("should refund the exact amount", async () => {});

        it("relayer should not overpay", async () => {});
    });
});
