import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, providers, Signer, Wallet } from "ethers";
import {
    walletSetup,
    factorySetup,
    encodeFunctionData,
    sign,
    signTypedData,
    generateTransaction
} from "../utils";
import { Transaction, Address, Domain } from "../types";
import { ownerWallet } from "../constants/constants";

const mock = ethers.Wallet.createRandom().address;
const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Setup", () => {
    let owner: Signer;
    let ownerAddress: Address;
    let recoveryOwner: Signer;
    let recoveryOwnerAddr: Address;
    let guardians: Address[];
    let _guardian1: Signer;
    let _guardian2: Signer;

    beforeEach(async () => {
        [
            owner,
            recoveryOwner,
            _guardian1,
            _guardian2
        ] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwnerAddr = await recoveryOwner.getAddress();
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress()
        ];
    });

    describe("Utils", () => {
        it("should return correct signer if v is adjusted to 31", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians
            );
            const hash = ethers.utils.keccak256("0x1234");
            const sig = await sign(owner, hash);
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            const signer = await wallet.returnSigner(hash, r, s, v);
            expect(signer).to.equal(ownerAddress);
        });

        it("should return correct signer by signing the hash", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
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
                tx.gasTip
            );
            const sig = await sign(owner, hash);
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            const signer = await wallet.returnSigner(hash, r, s, v);
            expect(signer).to.equal(ownerAddress);
        });

        it("should return correct signer by signing typed data", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians
            );

            const tx = await generateTransaction();
            tx.to = address;
            const domain: Domain = {
                chainId: await wallet.getChainId(),
                verifyingContract: address
            };

            const sig = await signTypedData(ownerWallet, domain, tx);
            const hash = await wallet.operationHash(
                tx.to,
                tx.value,
                tx.callData,
                tx.nonce,
                tx.maxFeePerGas,
                tx.maxPriorityFeePerGas,
                tx.gasTip
            );
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            const signer = await wallet.returnSigner(hash, r, s, v);
            expect(signer).to.equal(ownerAddress);
        });

        it("should correctly split 'v', 'r', and 's' ", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
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
                recoveryOwnerAddr,
                guardians
            );
            const hash = ethers.utils.keccak256("0x1234");
            const sig = (await sign(owner, hash)).replace(/1f$/, "03");
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            await expect(wallet.returnSigner(hash, r, s, v)).to.be.revertedWith(
                "Utils__InvalidSignature()"
            );
        });
    });
});
