import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import {
    walletSetup,
    guardian,
    encodeFunctionData,
    safeTx,
    paddedSignature,
    execTx,
    specialOwner
} from "../utils";

import { sign } from "../utils/sign";
const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Migration", () => {
    let relayer: Signer;

    beforeEach(async () => {
        [relayer] = await ethers.getSigners(); // Relayer is the special owner.
    });

    describe("Correct setup", async () => {
        it("Init", async () => {
            const { address, wallet } = await walletSetup(relayer);
            await guardian(address);
        });
    });

    describe("Migrate Singleton", async () => {
        it("should revert by calling the function directly", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const randy = ethers.Wallet.createRandom();
            await expect(
                wallet.upgradeSingleton(randy.address)
            ).to.be.revertedWith("'SA: Only callable from the wallet'");
        });

        it("should fail by providing an incorrect singleton address", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const fakeSingleton = ethers.Wallet.createRandom();
            safeTx.to = address;
            safeTx.data = encodeFunctionData(abi, "upgradeSingleton", [
                fakeSingleton.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                0,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);
            await expect(execTx(wallet, safeTx)).to.be.reverted;
        });

        it("should fail by providing a contract without interface support", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const NEW_SINGLETON = await ethers.getContractFactory(
                "IncorrectMigrate"
            );
            const newSingleton = await NEW_SINGLETON.deploy();
            safeTx.to = address;
            safeTx.data = encodeFunctionData(abi, "upgradeSingleton", [
                newSingleton.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                0,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);
            await expect(execTx(wallet, safeTx)).to.be.reverted;
        });

        it("should migrate to a new singleton", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const NEW_SINGLETON = await ethers.getContractFactory(
                "TestMigrate"
            );
            const newSingleton = await NEW_SINGLETON.deploy();
            safeTx.to = address;
            safeTx.data = encodeFunctionData(abi, "upgradeSingleton", [
                newSingleton.address
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                0,
                safeTx.data,
                0
            );
            safeTx.signature = await sign(specialOwner, hash);
            await execTx(wallet, safeTx);
            const newAbi = [
                "function imNew() external view returns (string memory)"
            ];
            const newWallet = new ethers.Contract(address, newAbi, relayer);
            expect(await newWallet.imNew()).to.equal("New");
            await guardian(address);
        });
    });
});
