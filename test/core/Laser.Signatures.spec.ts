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
    mockSetup,
} from "../utils";
import { Address, Domain, Transaction, types } from "../types";
import { ownerWallet } from "../constants/constants";

const MAGIC_VALUE = "0x1626ba7e";

type ContractSig = {
    r: string;
    s: string;
    v: string;
    signatureLength: string;
};
function generateContractSignature(walletAddress: Address, walletSignatures: string): ContractSig {
    const r = "000000000000000000000000" + walletAddress.replace("0x", "");

    const s = "0000000000000000000000000000000000000000000000000000000000000%&/";
    const v = "00";

    const signatureLength = `00000000000000000000000000000000000000000000000000000000000000${Math.abs(
        walletSignatures.length / 2
    ).toString(16)}`;

    return {
        r,
        s,
        v,
        signatureLength,
    };
}

describe("Signatures", () => {
    let addresses: AddressesForTest;
    let tx: Transaction;
    let mockUtils: Contract;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        tx = await generateTransaction();

        const _mockUtils = await ethers.getContractFactory("MockUtils");
        mockUtils = await _mockUtils.deploy();
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
            const walletTxHash = await wallet.operationHash(tx.to, tx.value, tx.callData, tx.nonce);
            expect(transactionHash).to.equal(walletTxHash);
        });

        it("should return correct chain id", async () => {
            const { wallet } = await walletSetup();
            const { chainId } = await ethers.provider.getNetwork();
            expect(chainId).to.equal(await wallet.getChainId());
        });
    });

    describe("Contract signatures", () => {
        let mockHash: string;
        let owner: Wallet;
        let recoveryOwner: Wallet;
        let guardian: Wallet;

        beforeEach(async () => {
            mockHash = ethers.utils.keccak256("0x123456");
            owner = ethers.Wallet.createRandom();
            recoveryOwner = ethers.Wallet.createRandom();
            guardian = ethers.Wallet.createRandom();
        });

        it("should revert if the EOA signature is incorrect", async () => {
            const { address2, wallet2 } = await mockSetup(
                owner.address,
                [recoveryOwner.address],
                [guardian.address],
                owner
            );

            const badHash = ethers.utils.keccak256("0xbeef");
            const sig1 = await sign(owner, mockHash);
            const sig2 = await sign(recoveryOwner, mockHash);
            const contractSigs = sig1.slice(2) + sig2.slice(2);

            // data position is encoded into s.
            let { r, s, v, signatureLength } = generateContractSignature(address2, contractSigs);
            s = s.replace("%&/", "0A2");

            // We generate the owner signature.
            const { address, wallet } = await walletSetup(undefined, [address2]);
            const { ownerSigner } = await signersForTest();
            const ownerSignature = await sign(ownerSigner, mockHash);

            // We concatenate the signatures.
            const signatures = ownerSignature + r + s + v + signatureLength + contractSigs;

            await expect(wallet.isValidSignature(badHash, signatures)).to.be.revertedWith(
                "LaserWallet__invalidSignature()"
            );
        });

        it("should sign (normal EOA + contract signature)", async () => {
            const { address2, wallet2 } = await mockSetup(
                owner.address,
                [recoveryOwner.address],
                [guardian.address],
                owner
            );

            const sig1 = await sign(owner, mockHash);
            const sig2 = await sign(recoveryOwner, mockHash);
            const contractSigs = sig1.slice(2) + sig2.slice(2);
            expect(await wallet2.isValidSignature(mockHash, "0x" + contractSigs)).to.equal(MAGIC_VALUE);

            // data position is encoded into s.
            let { r, s, v, signatureLength } = generateContractSignature(address2, contractSigs);
            s = s.replace("%&/", "0A2");

            // We generate the owner signature.
            const { address, wallet } = await walletSetup(undefined, [address2]);
            const { ownerSigner } = await signersForTest();
            const ownerSignature = await sign(ownerSigner, mockHash);

            // We concatenate the signatures.
            const signatures = ownerSignature + r + s + v + signatureLength + contractSigs;

            expect(await wallet.isValidSignature(mockHash, signatures)).to.equal(MAGIC_VALUE);
        });

        it("should sign (contract signature + normal EOA)", async () => {
            const { address2, wallet2 } = await mockSetup(
                owner.address,
                [recoveryOwner.address],
                [guardian.address],
                owner
            );

            const sig1 = await sign(owner, mockHash);
            const sig2 = await sign(recoveryOwner, mockHash);
            const contractSigs = sig1.slice(2) + sig2.slice(2);
            expect(await wallet2.isValidSignature(mockHash, "0x" + contractSigs)).to.equal(MAGIC_VALUE);

            // data position is encoded into s.
            let { r, s, v, signatureLength } = generateContractSignature(address2, contractSigs);
            s = s.replace("%&/", "0B2");

            // We generate the owner signature.
            const { address, wallet } = await walletSetup(undefined, [address2]);
            const { ownerSigner } = await signersForTest();
            const ownerSignature = await sign(ownerSigner, mockHash);

            const scratchSpace = "00000000000000000000000000000000";
            // We concatenate the signatures.
            const signatures =
                "0x" + r + s + v + ownerSignature.slice(2) + scratchSpace + signatureLength + contractSigs;
            const signer1 = await mockUtils.returnSigner(mockHash, signatures, 0);
            expect(signer1).to.equal(address2);
            const signer2 = await mockUtils.returnSigner(mockHash, signatures, 1);
            expect(signer2).to.equal(await wallet.owner());
        });

        it("should sign (contract signature + contract signature)", async () => {
            // recovery owner
            const rOwner = ethers.Wallet.createRandom();
            const rrOwner = ethers.Wallet.createRandom();
            const rGuardian = ethers.Wallet.createRandom();
            const recoveryOwner = await mockSetup(rOwner.address, [rrOwner.address], [rGuardian.address], rOwner);

            // guardian
            const gOwner = ethers.Wallet.createRandom();
            const rgOwner = ethers.Wallet.createRandom();
            const gGuardian = ethers.Wallet.createRandom();
            const guardian = await mockSetup(gOwner.address, [rgOwner.address], [gGuardian.address], gOwner);

            // Signature of the recovery owner.
            const rsig1 = await sign(rOwner, mockHash);
            const rsig2 = await sign(rrOwner, mockHash);
            const rSigs = rsig1.slice(2) + rsig2.slice(2);
            expect(await recoveryOwner.wallet2.isValidSignature(mockHash, "0x" + rSigs)).to.equal(MAGIC_VALUE);
            let rSignatures = generateContractSignature(recoveryOwner.address2, rSigs);
            rSignatures.s = rSignatures.s.replace("%&/", "0A2");

            // Signature of the guardian.
            const gsig1 = await sign(gOwner, mockHash);
            const gsig2 = await sign(rgOwner, mockHash);
            const gSigs = gsig1.slice(2) + gsig2.slice(2);
            expect(await guardian.wallet2.isValidSignature(mockHash, "0x" + gSigs)).to.equal(MAGIC_VALUE);
            let gSignatures = generateContractSignature(guardian.address2, gSigs);
            gSignatures.s = gSignatures.s.replace("%&/", "154");
            const scratchSpace = "00000000000000000000000000000000";
            const completeSigs =
                "0x" +
                rSignatures.r +
                rSignatures.s +
                rSignatures.v +
                gSignatures.r +
                gSignatures.s +
                gSignatures.v +
                rSignatures.signatureLength +
                rSigs +
                scratchSpace +
                gSignatures.signatureLength +
                gSigs;

            const signer1 = await mockUtils.returnSigner(mockHash, completeSigs, 0);
            expect(signer1).to.equal(recoveryOwner.address2);

            const signer2 = await mockUtils.returnSigner(mockHash, completeSigs, 1);
            expect(signer2).to.equal(guardian.address2);
        });

        it("should sign (contract signature inside of another contract signature)", async () => {});
        // @TODO: more complex signature setups (a contract signature has another contract signature ..)
    });
});
