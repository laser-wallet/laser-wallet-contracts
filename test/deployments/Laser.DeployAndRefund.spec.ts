import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Signer, Wallet } from "ethers";
import {
    walletSetup,
    addressesForTest,
    AddressesForTest,
    signersForTest,
    encodeFunctionData,
    SignersForTest,
} from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Deploy and create", () => {
    let addresses: AddressesForTest;
    let signers: SignersForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    describe("createProxyAndRefund", () => {
        it("should revert if wallet has no funds", async () => {
            await expect(walletSetup(undefined, undefined, undefined, 100, 100, 500000)).to.be.reverted;
        });
    });
});
