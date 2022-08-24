import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract } from "ethers";
import {
    walletSetup,
    addressesForTest,
    AddressesForTest,
    signersForTest,
    generateTransaction,
    encodeFunctionData,
    getRecoveryHash,
    signAndBundle,
    SignersForTest,
    getHash,
    sign,
    fundWallet,
    sendTx,
} from "../utils";
import { Address, Transaction } from "../types";
import { addrZero } from "../constants/constants";
import { LaserWallet } from "../../typechain-types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Migration", () => {
    let addresses: AddressesForTest;
    let signers: SignersForTest;
    let factory: Contract;
    let tx: Transaction;
    let newSingleton: LaserWallet;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        signers = await signersForTest();
        tx = generateTransaction();

        const singleton = await ethers.getContractFactory("LaserWallet");
        newSingleton = await singleton.deploy();
    });

    describe("changeSingleton()", () => {
        it("should not allow to call the function directly", async () => {
            const { wallet } = await walletSetup();

            await expect(wallet.changeSingleton(ethers.Wallet.createRandom().address)).to.be.revertedWith(
                "Access__notAllowed()"
            );
        });

        it("should fail if the new singleton is an EOA", async () => {
            const { address, wallet } = await walletSetup();
            const eoa = ethers.Wallet.createRandom().address;

            tx.to = address;
            tx.value = 0;
            tx.callData = encodeFunctionData(abi, "changeSingleton", [eoa]);
            tx.nonce = await wallet.nonce();

            const hash = await getHash(wallet, tx);
            tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);

            await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
        });

        it("should fail if the new singleton is the current singleton", async () => {
            const { address, wallet } = await walletSetup();
            const currentSingleton = await wallet.singleton();
            tx.to = address;
            tx.value = 0;
            tx.callData = encodeFunctionData(abi, "changeSingleton", [currentSingleton]);
            tx.nonce = await wallet.nonce();

            const hash = await getHash(wallet, tx);
            tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);

            await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
        });

        it("should fail if the new singleton is the current wallet", async () => {
            const { address, wallet } = await walletSetup();
            tx.to = address;
            tx.value = 0;
            tx.callData = encodeFunctionData(abi, "changeSingleton", [address]);
            tx.nonce = await wallet.nonce();

            const hash = await getHash(wallet, tx);
            tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);

            await expect(sendTx(wallet, tx)).to.be.revertedWith("LW__exec__callFailed()");
        });

        it("should migrate to a new singleton", async () => {
            const { address, wallet } = await walletSetup();

            const currentSingleton = await wallet.singleton();
            expect(currentSingleton).to.not.equal(newSingleton.address);

            tx.to = address;
            tx.value = 0;
            tx.callData = encodeFunctionData(abi, "changeSingleton", [newSingleton.address]);
            tx.nonce = await wallet.nonce();

            const hash = await getHash(wallet, tx);
            tx.signatures = await signAndBundle(signers.ownerSigner, signers.guardian1Signer, hash);

            await sendTx(wallet, tx);

            // Should be changed.
            expect(await wallet.singleton()).to.equal(newSingleton.address);

            // Should have the same state.
            expect(await wallet.owner()).to.equal(addresses.owner);
        });
    });
});
