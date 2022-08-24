import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract } from "ethers";
import {
    walletSetup,
    addressesForTest,
    AddressesForTest,
    signersForTest,
    generateTransaction,
    SignersForTest,
    fundWallet,
    getHash,
} from "../utils";
import { sign } from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("MultiCall", () => {
    let addresses: AddressesForTest;
    let signers: SignersForTest;
    let factory: Contract;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        signers = await signersForTest();
    });

    describe("multiCall()", () => {
        it("should exec a batch of transactions", async () => {});
    });
});
