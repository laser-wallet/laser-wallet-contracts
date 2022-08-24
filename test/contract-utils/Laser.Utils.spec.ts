import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import {
    walletSetup,
    sign,
    signTypedData,
    generateTransaction,
    addressesForTest,
    signersForTest,
    AddressesForTest,
} from "../utils";
import { Address, Domain } from "../types";
import { addrZero, ownerWallet } from "../constants/constants";
import { Contract } from "ethers";

describe("Setup", () => {
    let addresses: AddressesForTest;
    let utils: Contract;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        const utilsFactory = await ethers.getContractFactory("MockUtils");
        utils = await utilsFactory.deploy();
    });

    describe("Utils", () => {
        it("should return correct signer if v is adjusted to 31", async () => {
            const { address, wallet } = await walletSetup();
            const { owner } = addresses;
            const { ownerSigner } = await signersForTest();
            const hash = ethers.utils.keccak256("0x1234");
            const sig = await sign(ownerSigner, hash);
            const signer = await utils.returnSigner(hash, sig, 0);
            expect(signer).to.equal(signer);
        });

        it("should return correct signer by signing the hash", async () => {
            const { address, wallet } = await walletSetup();
            const { owner } = addresses;
            const { ownerSigner } = await signersForTest();
            const tx = await generateTransaction();
            tx.to = address;
            const hash = await wallet.operationHash(tx.to, tx.value, tx.callData, tx.nonce);
            const sig = await sign(ownerSigner, hash);
            const signer = await utils.returnSigner(hash, sig, 0);
            expect(signer).to.equal(owner);
        });

        it("should return correct signer by signing typed data", async () => {
            const { address, wallet } = await walletSetup();
            const { owner } = addresses;
            const tx = await generateTransaction();
            tx.to = address;
            const domain: Domain = {
                chainId: await wallet.getChainId(),
                verifyingContract: address,
            };

            const sig = await signTypedData(ownerWallet, domain, tx);
            const hash = await wallet.operationHash(tx.to, tx.value, tx.callData, tx.nonce);
            const signer = await utils.returnSigner(hash, sig, 0);
            expect(signer).to.equal(owner);
        });

        it("should correctly split 'v', 'r', and 's' ", async () => {
            const { wallet } = await walletSetup();
            const { ownerSigner } = await signersForTest();
            const hash = ethers.utils.keccak256("0x1234");
            const sig = await sign(ownerSigner, hash);
            const [r, s, v] = await utils.splitSigs(sig, 0);
            expect(r).to.equal(sig.slice(0, 66));
            expect(s).to.equal(`0x${sig.slice(66, 130)}`);
            expect(v).to.equal(parseInt(sig.slice(130), 16));
        });

        it("should revert if the recovered signer is address(0)", async () => {
            const { address, wallet } = await walletSetup();
            const { ownerSigner } = await signersForTest();
            const hash = ethers.utils.keccak256("0x1234");
            const sig = (await sign(ownerSigner, hash)).replace(/1f$/, "03");
            const [r, s, v] = await utils.splitSigs(sig, 0);
            await expect(utils.returnSigner(hash, sig, 0)).to.be.revertedWith(
                "Utils__returnSigner__invalidSignature()"
            );
        });
    });
});
