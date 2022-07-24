import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { walletSetup } from "../utils";

describe("LaserHelper", () => {
    beforeEach(async () => {
        await deployments.fixture();
    });

    it("should return correct outputs", async () => {
        const { address, wallet } = await walletSetup();
        const Helper = await deployments.get("LaserHelper");
        const helper = await ethers.getContractAt(Helper.abi, Helper.address);

        const results = await helper.getWalletState(address);

        expect(results.owner).to.equal(await wallet.owner());
        expect(results.singleton).to.equal(await wallet.singleton());
        expect(results.isLocked).to.equal(false);
        expect(results.isLocked).to.equal(await wallet.isLocked());
        expect(results.balance).to.equal(0);
    });
});
