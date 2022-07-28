import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Address } from "../types";
import { addressesForTest, walletSetup } from "../utils";

describe("LaserHelper", () => {
    let SSRModule: Address;

    beforeEach(async () => {
        await deployments.fixture();

        SSRModule = (await deployments.get("LaserModuleSSR")).address;
    });

    it("should return correct outputs", async () => {
        const { address, wallet } = await walletSetup();
        const { recoveryOwners, guardians } = await addressesForTest();
        const Helper = await deployments.get("LaserHelper");
        const helper = await ethers.getContractAt(Helper.abi, Helper.address);

        const results = await helper.getWalletState(address, SSRModule);

        expect(results.owner).to.equal(await wallet.owner());
        expect(results.singleton).to.equal(await wallet.singleton());
        expect(results.isLocked).to.equal(false);
        expect(results.isLocked).to.equal(await wallet.isLocked());
        expect(results.balance).to.equal(0);
        expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(results.recoveryOwners));
        expect(JSON.stringify(guardians)).to.equal(JSON.stringify(results.guardians));
    });
});
