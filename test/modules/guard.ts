import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer, Wallet } from "ethers";

import {
    guardian,
    walletSetup,
    oneEth,
    safeTx,
    specialOwner,
    encodeFunctionData
} from "../utils";
import { sign } from "../utils/sign";

const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Guard", () => {
    let relayer: Signer;
    let relayerAddress: string;
    let tenEth: BigNumber;

    beforeEach(async () => {
        [relayer] = await ethers.getSigners();
        relayerAddress = await relayer.getAddress();
        tenEth = ethers.utils.parseEther("10");
    });

    describe("Correct setup", () => {
        it("Init", async () => {
            const { address, wallet } = await walletSetup(relayer);
            await guardian(address);
        });
    });

    describe("Guard", () => {
        it("should revert by calling 'updateEthSpendingLimit' directly", async () => {
            const { address, wallet } = await walletSetup(relayer);
            await expect(
                wallet.updateEthSpendingLimit(1000)
            ).to.be.revertedWith("SA: Only callable from the wallet");
        });

        it("should revert by calling 'removeEthSpendingLimit' directly", async () => {
            const { address, wallet } = await walletSetup(relayer);
            await expect(wallet.removeEthSpendingLimit()).to.be.revertedWith(
                "SA: Only callable from the wallet"
            );
        });

        it("should have 0 ethSpending limit", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.ethSpendingLimit()).to.equal(0);
        });

        it("should have 1 Eth as spending limit", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                undefined,
                undefined,
                undefined,
                undefined,
                oneEth
            );
            expect(await wallet.ethSpendingLimit()).to.equal(oneEth);
        });

        it("should revert if transaction exceeds spending limit", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                undefined,
                undefined,
                undefined,
                undefined,
                oneEth
            );
            await relayer.sendTransaction({ to: address, value: tenEth });
            safeTx.to = relayerAddress;
            safeTx.value = oneEth.add(1);
            safeTx.data = "0x";
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            const sig1 = await sign(specialOwner, hash);
            await expect(
                wallet.execTransaction(
                    safeTx.to,
                    safeTx.value,
                    safeTx.data,
                    sig1
                )
            ).to.be.revertedWith("GUARD: Transaction exceeds limit");
        });

        it("should deactivate the module", async () => {
            const { address, wallet } = await walletSetup(
                relayer,
                undefined,
                undefined,
                undefined,
                undefined,
                oneEth
            );
            expect(await wallet.ethSpendingLimit()).to.equal(oneEth);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "removeEthSpendingLimit", []);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            const sig1 = await sign(specialOwner, hash);
            await wallet.execTransaction(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                sig1
            );
            expect(await wallet.ethSpendingLimit()).to.equal(0);
        });

        it("should update the Eth spending limit", async () => {
            const { address, wallet } = await walletSetup(relayer);
            expect(await wallet.ethSpendingLimit()).to.equal(0);
            safeTx.to = address;
            safeTx.value = 0;
            safeTx.data = encodeFunctionData(abi, "updateEthSpendingLimit", [
                oneEth
            ]);
            const hash = await wallet.getTransactionHash(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                0
            );
            const sig1 = await sign(specialOwner, hash);
            await wallet.execTransaction(
                safeTx.to,
                safeTx.value,
                safeTx.data,
                sig1
            );
            expect(await wallet.ethSpendingLimit()).to.equal(oneEth);
        });
    });
});
