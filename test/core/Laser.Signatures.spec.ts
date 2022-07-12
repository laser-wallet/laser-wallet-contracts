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

const MAGIC_VALUE = "0x1626ba7e";

describe("Signatures", () => {
    let addresses: AddressesForTest;
    let tx: Transaction;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        tx = await generateTransaction();
    });

    describe("Correct data", () => {
        // it("should have correct domain separator", async () => {
        //     const { address, wallet } = await walletSetup();
        //     const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain({
        //         verifyingContract: address,
        //         chainId: await wallet.getChainId(),
        //     });
        //     expect(domainSeparator).to.equal(await wallet.domainSeparator());
        // });
        // it("should calculate correctly the transaction hash", async () => {
        //     const { address, wallet } = await walletSetup();
        //     tx.to = address;
        //     const transactionHash = ethers.utils._TypedDataEncoder.hash(
        //         {
        //             verifyingContract: wallet.address,
        //             chainId: await wallet.getChainId(),
        //         },
        //         types,
        //         tx
        //     );
        //     const walletTxHash = await wallet.operationHash(
        //         tx.to,
        //         tx.value,
        //         tx.callData,
        //         tx.nonce,
        //         tx.maxFeePerGas,
        //         tx.maxPriorityFeePerGas,
        //         tx.gasLimit
        //     );
        //     expect(transactionHash).to.equal(walletTxHash);
        // });
        // it("should return correct chain id", async () => {
        //     const { wallet } = await walletSetup();
        //     const { chainId } = await ethers.provider.getNetwork();
        //     expect(chainId).to.equal(await wallet.getChainId());
        // });
    });

    describe("contract signatures 'EIP 1271", () => {
        let mockHash: string;

        beforeEach(() => {
            mockHash = ethers.utils.keccak256("0x1234");
        });

        // it("should revert if a guardian signs the hash", async () => {
        //     const { wallet } = await walletSetup();
        //     const { guardian1Signer } = await signersForTest();
        //     const sig = await sign(guardian1Signer, mockHash);

        //     await expect(wallet.isValidSignature(mockHash, sig)).to.be.revertedWith(
        //         "'LaserWallet__invalidSignature()'"
        //     );
        // });

        // it("should revert if a recovery owner signs the hash", async () => {
        //     const { wallet } = await walletSetup();
        //     const { recoveryOwner1Signer } = await signersForTest();
        //     const sig = await sign(recoveryOwner1Signer, mockHash);

        //     await expect(wallet.isValidSignature(mockHash, sig)).to.be.revertedWith(
        //         "'LaserWallet__invalidSignature()'"
        //     );
        // });

        // it("should revert if random signers sign the hash", async () => {
        //     const { wallet } = await walletSetup();

        //     for (let i = 0; i < 10; i++) {
        //         const randomSigner = ethers.Wallet.createRandom();
        //         const sig = await sign(randomSigner, mockHash);
        //         await expect(wallet.isValidSignature(mockHash, sig)).to.be.revertedWith(
        //             "'LaserWallet__invalidSignature()'"
        //         );
        //     }
        // });

        // it("should return magic value if it is signed by the owner", async () => {
        //     const { wallet } = await walletSetup();
        //     const { ownerSigner } = await signersForTest();
        //     const sig = await sign(ownerSigner, mockHash);

        //     expect(await wallet.isValidSignature(mockHash, sig)).to.equal(MAGIC_VALUE);
        // });

        it("should ..", async () => {
            const { address, wallet } = await walletSetup();
            const hash = ethers.utils.keccak256("0x1234");
            const { ownerSigner } = await signersForTest();

            const sig = await sign(ownerSigner, hash);
            let newSig = sig.slice(0, sig.length - 2);
            const finalSig = (newSig += "00");
            const sigs = contractSig(address, sig);
            // const [r, s, v] = await wallet.splitSigs(sigs, 0);
            // await wallet.returnSigner(hash, r, s, v, sigs);
        });
    });
});

function contractSig(ownerAddress: Address, ownerSig: string): string {
    let sig = "0x";
    const r = "000000000000000000000000" + ownerAddress.replace("0x", ""); // r
    const s = "00000000000000000000000000000000000000000000000000000000000000a2"; // s
    const v = "00";
    sig += r + s + v;

    sig += "0000000000000000000000000000000000000000000000000000000000000000" + ownerSig.replace("0x", "");
    return sig;
}
