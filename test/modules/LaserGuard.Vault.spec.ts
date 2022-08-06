import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import {
    walletSetup,
    sign,
    generateTransaction,
    addressesForTest,
    signersForTest,
    AddressesForTest,
    encodeFunctionData,
    getHash,
    sendTx,
    fundWallet,
    isAddress,
    initSSR,
    SignersForTest,
    getGuardians,
    getRecoveryOwners,
    removeTokensFromVault,
    addTokensToVault,
} from "../utils";
import { Address, Domain, Transaction } from "../types";
import { addrZero } from "../constants/constants";
import hre from "hardhat";
import { Contract } from "ethers";
import { LaserVault, LaserVault__factory } from "../../typechain-types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

const ETH_VAULT = "0xc9e6c67284a1cefbad549c4af8200e564a75ca4c";

describe("Laser Vault", () => {
    let addresses: AddressesForTest;
    let signers: SignersForTest;
    let tx: Transaction;
    let laserVault: LaserVault;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        signers = await signersForTest();
        tx = await generateTransaction();
        const _laserVault = await deployments.get("LaserVault");
        laserVault = LaserVault__factory.connect(_laserVault.address, ethers.provider);
    });

    describe("ETH", () => {
        it("should add Eth to vault and update balance", async () => {
            const { address, wallet } = await walletSetup();
            await fundWallet(signers.ownerSigner, address);

            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(0);
            const ethToVault = ethers.utils.parseEther("10000");
            // We add eth to vault.
            tx.to = laserVault.address;
            tx.callData = addTokensToVault(ETH_VAULT, ethToVault);
            const hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await sendTx(wallet, tx);

            // Should be added.
            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(ethToVault);
        });

        it("should remove eth from vault and update balance", async () => {
            const { address, wallet } = await walletSetup();
            await fundWallet(signers.ownerSigner, address);

            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(0);
            const ethToVault = ethers.utils.parseEther("10000");
            // We add eth to vault.
            tx.to = laserVault.address;
            tx.callData = addTokensToVault(ETH_VAULT, ethToVault);
            let hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await sendTx(wallet, tx);

            // Should be added.
            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(ethToVault);

            // We remove the eth.
            tx.callData = removeTokensFromVault(ETH_VAULT, ethToVault);
            tx.nonce = 1;
            hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await sendTx(wallet, tx);

            // Should be removed.
            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(0);
        });

        it("should revert if tx wants to use eth from the vault", async () => {
            const { address, wallet } = await walletSetup();
            await fundWallet(signers.ownerSigner, address);

            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(0);
            const ethToVault = ethers.utils.parseEther("10000");
            // We add eth to vault.
            tx.to = laserVault.address;
            tx.callData = addTokensToVault(ETH_VAULT, ethToVault);
            let hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await sendTx(wallet, tx);

            // Should be added.
            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(ethToVault);

            // We exec the second transaction.
            tx.to = ethers.Wallet.createRandom().address;
            tx.value = 1000; // There is more eth in the vault than in the wallet.
            tx.nonce = 1;
            tx.callData = "0x";
            hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await expect(sendTx(wallet, tx)).to.be.revertedWith("LaserVault__verifyEth__ethInVault");
        });

        it("should revert if tx wants to use more eth than allowed", async () => {
            const { address, wallet } = await walletSetup();
            await fundWallet(signers.ownerSigner, address);

            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(0);
            const ethToVault = (await ethers.provider.getBalance(address)).sub(1000);
            // We add eth to vault.
            tx.to = laserVault.address;
            tx.callData = addTokensToVault(ETH_VAULT, ethToVault);
            let hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await sendTx(wallet, tx);

            // Should be added.
            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(ethToVault);

            // We exec the second transaction.
            tx.to = ethers.Wallet.createRandom().address;
            tx.value = 1000; // There is more eth in the vault than in the wallet.
            tx.nonce = 1;
            tx.callData = "0x";
            hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await expect(sendTx(wallet, tx)).to.be.revertedWith("LaserVault__verifyEth__ethInVault");
        });

        it("should allow to do an eth transfer if enough funds are out of the vault", async () => {
            const { address, wallet } = await walletSetup();
            await fundWallet(signers.ownerSigner, address);

            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(0);
            const ethToVault = ethers.utils.parseEther("0.9");
            // We add eth to vault.
            tx.to = laserVault.address;
            tx.callData = addTokensToVault(ETH_VAULT, ethToVault);
            let hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await sendTx(wallet, tx);

            // Should be added.
            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(ethToVault);

            // We exec the second transaction.
            tx.to = ethers.Wallet.createRandom().address;
            tx.value = 1000; // There is more eth in the vault than in the wallet.
            tx.nonce = 1;
            tx.callData = "0x";
            hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await sendTx(wallet, tx);

            expect(await ethers.provider.getBalance(tx.to)).to.equal(tx.value);
        });
    });

    describe("ERC20 tokens", () => {
        it("should ..", async () => {});
    });
});
