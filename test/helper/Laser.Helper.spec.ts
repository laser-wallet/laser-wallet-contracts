import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { encodeFunctionData, walletSetup } from "../utils";
import { LaserHelper__factory, LaserHelper } from "../../typechain-types";
import { providers } from "ethers";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("LaserHelper", () => {
    let helper: LaserHelper;

    beforeEach(async () => {
        await deployments.fixture();

        const _helper = await deployments.get("LaserHelper");
        helper = LaserHelper__factory.connect(_helper.address, ethers.provider);
    });

    describe("Laser Helper", () => {
        it("shoud return correct state", async () => {
            const { address, wallet } = await walletSetup();

            const { owner, guardians, recoveryOwners, singleton, isLocked, configTimestamp, nonce, balance } =
                await helper.getLaserState(address);

            expect(owner).to.equal(await wallet.owner());
            expect(JSON.stringify(guardians)).to.equal(JSON.stringify(await wallet.getGuardians()));
            expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(await wallet.getRecoveryOwners()));
            expect(singleton).to.equal(await wallet.singleton());
            expect(isLocked).to.equal(await wallet.isLocked());
            expect(configTimestamp).to.equal(await wallet.getConfigTimestamp());
            expect(nonce).to.equal(await wallet.nonce());
            expect(balance).to.equal(await ethers.provider.getBalance(address));
        });
    });
});
