import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
    walletSetup,
    sign,
    signTypedData,
    generateTransaction,
} from "../utils";
import { Address, Domain } from "../types";
import { ownerWallet } from "../constants/constants";

describe("Setup", () => {
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
            relayer,
        ] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();

        recoveryOwners = [
            await recoveryOwner1.getAddress(),
            await recoveryOwner2.getAddress(),
        ];
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress(),
        ];
    });

    describe("Utils", () => {
        it("should return correct signer if v is adjusted to 31", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const hash = ethers.utils.keccak256("0x1234");
            const sig = await sign(owner, hash);
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            const signer = await wallet.returnSigner(hash, r, s, v, sig);
            expect(signer).to.equal(ownerAddress);
        });

        it("should return correct signer by signing the hash", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );

            const tx = await generateTransaction();
            tx.to = address;
            const hash = await wallet.operationHash(
                tx.to,
                tx.value,
                tx.callData,
                tx.nonce,
                tx.maxFeePerGas,
                tx.maxPriorityFeePerGas,
                tx.gasLimit
            );
            const sig = await sign(owner, hash);
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            const signer = await wallet.returnSigner(hash, r, s, v, sig);
            expect(signer).to.equal(ownerAddress);
        });

        it("should return correct signer by signing typed data", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );

            const tx = await generateTransaction();
            tx.to = address;
            const domain: Domain = {
                chainId: await wallet.getChainId(),
                verifyingContract: address,
            };

            const sig = await signTypedData(ownerWallet, domain, tx);
            const hash = await wallet.operationHash(
                tx.to,
                tx.value,
                tx.callData,
                tx.nonce,
                tx.maxFeePerGas,
                tx.maxPriorityFeePerGas,
                tx.gasLimit
            );
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            const signer = await wallet.returnSigner(hash, r, s, v, sig);
            expect(signer).to.equal(ownerAddress);
        });

        it("should correctly split 'v', 'r', and 's' ", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const hash = ethers.utils.keccak256("0x1234");
            const sig = await sign(owner, hash);
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            expect(r).to.equal(sig.slice(0, 66));
            expect(s).to.equal(`0x${sig.slice(66, 130)}`);
            expect(v).to.equal(parseInt(sig.slice(130), 16));
        });

        it("should revert if the recovered signer is address(0)", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const hash = ethers.utils.keccak256("0x1234");
            const sig = (await sign(owner, hash)).replace(/1f$/, "03");
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            await expect(
                wallet.returnSigner(hash, r, s, v, sig)
            ).to.be.revertedWith("Utils__returnSigner__invalidSignature()");
        });
    });
});
