import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { walletSetup, signersForTest, AddressesForTest, addressesForTest } from "../utils";

const oneEth = ethers.utils.parseEther("1");

describe("Receive", () => {
    let addresses: AddressesForTest;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
    });

    it("should be able to receive eth via send transaction", async () => {
        const { wallet } = await walletSetup();
        const { owner } = addresses;
        const { ownerSigner } = await signersForTest();
        expect(
            await ownerSigner.sendTransaction({
                to: wallet.address,
                value: oneEth,
            })
        )
            .to.emit(wallet, "SafeReceived")
            .withArgs(owner, oneEth);
        const balance = await ethers.provider.getBalance(wallet.address);
        expect(balance).to.equal(oneEth);
    });

    it("should be able to receive eth via a contract call", async () => {
        const { address, wallet } = await walletSetup();
        const initialBalance = await ethers.provider.getBalance(wallet.address);
        expect(initialBalance).to.equal(0);
        const factoryCaller = await ethers.getContractFactory("Caller");
        const caller = await factoryCaller.deploy();
        const { ownerSigner } = await signersForTest();

        // Funding the caller.
        await ownerSigner.sendTransaction({
            to: caller.address,
            value: oneEth,
        });
        // Executing the transaction from the caller.
        await caller._call(address, oneEth, "0x");
        const postBalance = await ethers.provider.getBalance(wallet.address);
        expect(postBalance).to.equal(oneEth);
    });
});
