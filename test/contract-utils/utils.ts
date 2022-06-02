import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
    walletSetup,
    factorySetup,
    encodeFunctionData,
    sign,
    signTypedData,
    EIP712Sig,
} from "../utils";
import { userOp, types, Address } from "../types";
import { ownerWallet } from "../constants/constants";

const mock = ethers.Wallet.createRandom().address;
const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Setup", () => {
    let owner: Signer;
    let ownerAddress: Address;
    let recoveryOwner: Signer;
    let recoveryOwnerAddr: Address;
    let guardians: Address[];
    let entryPoint: Address;
    let _guardian1: Signer;
    let _guardian2: Signer;

    beforeEach(async () => {
        [owner, recoveryOwner, _guardian1, _guardian2] =
            await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwnerAddr = await recoveryOwner.getAddress();
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress(),
        ];
        const EP = await ethers.getContractFactory("TestEntryPoint");
        const _entryPoint = await EP.deploy(mock, 0, 0);
        entryPoint = _entryPoint.address;
    });

    describe("Utils", () => {
        it("should return correct signer if v is adjusted to 31", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians,
                entryPoint
            );
            const hash = ethers.utils.keccak256("0x1234");
            const sig = await sign(owner, hash);
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            const signer = await wallet.returnSigner(hash, r, s, v);
            expect(signer).to.equal(ownerAddress);
        });

        it("should return correct signer by signing typed data", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians,
                entryPoint
            );

            // This is just to check the signature, it is mocking a transaction only
            // for the purposes of the Utils contract (not an actual transaction).
            userOp.sender = address;
            userOp.nonce = 0;
            userOp.callData = "0x";
            const domain = {
                chainId: await wallet.getChainId(),
                verifyingContract: address,
            };
            const txMessage = {
                sender: userOp.sender,
                nonce: userOp.nonce,
                callData: userOp.callData,
                callGas: userOp.callGas,
                verificationGas: userOp.verificationGas,
                preVerificationGas: userOp.preVerificationGas,
                maxFeePerGas: userOp.maxFeePerGas,
                maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
                paymaster: userOp.paymaster,
                paymasterData: userOp.paymasterData,
            };

            const sig = await EIP712Sig(ownerWallet, domain, txMessage);
            const hash = await wallet.userOperationHash(userOp);
            const [r, s, v] = await wallet.splitSigs(sig, 0);
            const signer = await wallet.returnSigner(hash, r, s, v);
            expect(signer).to.equal(ownerAddress);
        });

        it("should correctly split 'v', 'r', and 's' ", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians,
                entryPoint
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
                guardians,
                entryPoint
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
