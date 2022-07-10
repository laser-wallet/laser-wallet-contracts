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
import { Address, Domain, Transaction, types } from "../types";
import { ownerWallet } from "../constants/constants";

describe("Signatures", () => {
    let addresses: AddressesForTest;
    let tx: Transaction;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        tx = await generateTransaction();
    });

    describe("Correct data", () => {
        it("should have correct domain separator", async () => {
            const { address, wallet } = await walletSetup();
            const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain({
                verifyingContract: address,
                chainId: await wallet.getChainId(),
            });
            expect(domainSeparator).to.equal(await wallet.domainSeparator());
        });

        it("should calculate correctly the transaction hash", async () => {
            const { address, wallet } = await walletSetup();
            tx.to = address;
            const transactionHash = ethers.utils._TypedDataEncoder.hash(
                {
                    verifyingContract: wallet.address,
                    chainId: await wallet.getChainId(),
                },
                types,
                tx
            );
            const walletTxHash = await wallet.operationHash(
                tx.to,
                tx.value,
                tx.callData,
                tx.nonce,
                tx.maxFeePerGas,
                tx.maxPriorityFeePerGas,
                tx.gasLimit
            );
            expect(transactionHash).to.equal(walletTxHash);
        });

        it("should return correct chain id", async () => {
            const { address, wallet } = await walletSetup();
            const { chainId } = await ethers.provider.getNetwork();
            expect(chainId).to.equal(await wallet.getChainId());
        });
    });
});
