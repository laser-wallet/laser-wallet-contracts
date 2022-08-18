import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { LaserMasterGuard, LaserMasterGuard__factory } from "../../typechain-types";
import { SignersForTest, signersForTest } from "../utils";

describe("Laser Master Guard", () => {
    let laserMasterGuard: LaserMasterGuard;
    let signers: SignersForTest;

    beforeEach(async () => {
        await deployments.fixture();
        const _laserMasterGuard = await deployments.get("LaserMasterGuard");
        laserMasterGuard = LaserMasterGuard__factory.connect(_laserMasterGuard.address, ethers.provider);
        signers = await signersForTest();
    });

    describe("Setup", () => {
        it("should have correct laser registry address", async () => {
            const LR = (await deployments.get("LaserRegistry")).address;

            expect(await laserMasterGuard.LASER_REGISTRY()).to.equal(LR);
        });

        it("should have correct smart social recovery address", async () => {
            const SSR = (await deployments.get("LaserModuleSSR")).address;

            expect(await laserMasterGuard.LASER_SMART_SOCIAL_RECOVERY()).to.equal(SSR);
        });
        //@todo more checks on setup.
    });
});
