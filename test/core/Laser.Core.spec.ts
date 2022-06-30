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
import { types, Address } from "../types";
import { ownerWallet, tenEth, twoEth } from "../constants/constants";

const mock = ethers.Wallet.createRandom().address;
const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Core", () => {
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
            relayer
        ] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwners = [
            await recoveryOwner1.getAddress(),
            await recoveryOwner2.getAddress()
        ];
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress()
        ];
    });

    describe("init()", async () => {
        it("should not allow to call init after initialization", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );

            await expect(
                wallet.init(mock, recoveryOwners, guardians)
            ).to.be.revertedWith("Owner__initOwner__walletInitialized(");
        });
    });
});
