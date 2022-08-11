import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract } from "ethers";
import {
    walletSetup,
    addressesForTest,
    AddressesForTest,
    signersForTest,
    getRecoveryOwners,
    getGuardians,
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
        it("should exec a batch of transactions", async () => {
            const { address, wallet } = await walletSetup();
            await fundWallet(signers.ownerSigner, address);

            const tx = await generateTransaction();

            const targetTxCount = 10;

            const val = 100;

            const to = ethers.Wallet.createRandom().address;

            let transactions = [];
            for (let i = 0; i < 2; i++) {
                tx.to = to;
                tx.value = val;
                const nonce = i;
                tx.nonce = nonce;

                const hash = await getHash(wallet, tx);
                tx.signatures = await sign(signers.ownerSigner, hash);
                transactions.push(tx);
                await wallet.multiCall(transactions, { gasLimit: tx.gasLimit });
                break;
            }
        });
    });
});
