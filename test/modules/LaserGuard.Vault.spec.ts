import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import {
    walletSetup,
    sign,
    generateTransaction,
    addressesForTest,
    signersForTest,
    AddressesForTest,
    getHash,
    sendTx,
    fundWallet,
    SignersForTest,
    removeTokensFromVault,
    addTokensToVault,
    removeTokensFromVaultHash,
} from "../utils";
import { Transaction } from "../types";
import { BigNumber, Contract } from "ethers";
import { LaserVault, LaserVault__factory } from "../../typechain-types";

// address(bytes20(bytes32(keccak256("ETH.ENCODED.LASER")))
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

            const guardianHash = removeTokensFromVaultHash(ETH_VAULT, ethToVault, Number(await wallet.getChainId()));

            const guardianSignature = await sign(signers.guardian1Signer, guardianHash);
            // We remove the eth.
            tx.callData = removeTokensFromVault(ETH_VAULT, ethToVault, guardianSignature);
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

            const initialBalance = await ethers.provider.getBalance(address);
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
            expect(await ethers.provider.getBalance(address)).to.equal(initialBalance);
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

        it("should revert if max supply of eth is in the vault", async () => {
            const { address, wallet } = await walletSetup();
            await signers.ownerSigner.sendTransaction({
                to: address,
                value: ethers.utils.parseEther("100"),
            });

            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(0);
            const ethToVault = ethers.utils.parseEther("1000000000"); // more than total eth supply.

            // We add eth to vault.
            tx.to = laserVault.address;
            tx.callData = addTokensToVault(ETH_VAULT, ethToVault);
            let hash = await getHash(wallet, tx);
            tx.signatures = await sign(signers.ownerSigner, hash);
            await sendTx(wallet, tx);

            // Should be added.
            expect(await laserVault.getTokensInVault(address, ETH_VAULT)).to.equal(ethToVault);

            for (let i = 0; i < 5; i++) {
                const val = ethers.utils.parseEther("0.555");
                tx.to = ethers.Wallet.createRandom().address;
                tx.value = val;
                tx.nonce = 1;
                tx.callData = "0x";
                hash = await getHash(wallet, tx);
                tx.signatures = await sign(signers.ownerSigner, hash);
                await expect(sendTx(wallet, tx)).to.be.revertedWith("err");
            }
        });
    });

    describe("ERC20 tokens", () => {
        let erc20: Contract;
        let initialSupply: BigNumber;

        beforeEach(async () => {
            initialSupply = ethers.utils.parseEther("100000");
            const _erc20 = await ethers.getContractFactory("ERC20");
            erc20 = await _erc20.deploy("TestToken", "TT", 18, initialSupply);
        });

        describe("commom", () => {
            it("should have correct name", async () => {
                expect(await erc20.name()).to.equal("TestToken");
            });

            it("should have correct symbol", async () => {
                expect(await erc20.symbol()).to.equal("TT");
            });

            it("should have correct decimals", async () => {
                expect(await erc20.decimals()).to.equal(18);
            });

            it("should have correct initial supply", async () => {
                expect(await erc20.totalSupply()).to.equal(initialSupply);
            });

            it("msg.sender should have the initial supply", async () => {
                const bal = await erc20.balanceOf(addresses.owner); // Hardhat account 0.
                expect(bal).to.equal(initialSupply);
            });

            it("should add ERC20 to vault and update balance", async () => {
                const { address, wallet } = await walletSetup();
                await fundWallet(signers.ownerSigner, address);

                expect(await laserVault.getTokensInVault(address, erc20.address)).to.equal(0);
                const erc20ToVault = ethers.utils.parseEther("10000");
                // We add erc20 to vault.
                tx.to = laserVault.address;
                tx.callData = addTokensToVault(erc20.address, erc20ToVault);
                const hash = await getHash(wallet, tx);
                tx.signatures = await sign(signers.ownerSigner, hash);
                await sendTx(wallet, tx);

                // Should be added.
                expect(await laserVault.getTokensInVault(address, erc20.address)).to.equal(erc20ToVault);
            });

            it("should remove erc20 from vault and update balance", async () => {
                const { address, wallet } = await walletSetup();
                await fundWallet(signers.ownerSigner, address);

                expect(await laserVault.getTokensInVault(address, erc20.address)).to.equal(0);
                const erc20ToVault = ethers.utils.parseEther("10000");
                // We add erc20 to vault.
                tx.to = laserVault.address;
                tx.callData = addTokensToVault(erc20.address, erc20ToVault);
                let hash = await getHash(wallet, tx);
                tx.signatures = await sign(signers.ownerSigner, hash);
                await sendTx(wallet, tx);

                // Should be added.
                expect(await laserVault.getTokensInVault(address, erc20.address)).to.equal(erc20ToVault);

                const guardianHash = removeTokensFromVaultHash(
                    erc20.address,
                    erc20ToVault,
                    Number(await wallet.getChainId())
                );

                const guardianSignature = await sign(signers.guardian1Signer, guardianHash);
                // We remove the erc20.
                tx.callData = removeTokensFromVault(erc20.address, erc20ToVault, guardianSignature);
                tx.nonce = 1;
                hash = await getHash(wallet, tx);
                tx.signatures = await sign(signers.ownerSigner, hash);
                await sendTx(wallet, tx);

                // Should be removed.
                expect(await laserVault.getTokensInVault(address, erc20.address)).to.equal(0);
            });
        });

        describe("verifyERC20Transfer()", () => {});

        describe("verifyERC20IncreaseAllowance()", () => {});

        describe("verifyCommonApprove()", () => {});
    });
});
