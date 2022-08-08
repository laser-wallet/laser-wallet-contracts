import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const laserRegistryAddress = (await deployments.get("LaserRegistry")).address;
    const laserSSRAddress = (await deployments.get("LaserModuleSSR")).address;

    await deploy("LaserMasterGuard", {
        from: deployer,
        args: [laserRegistryAddress, laserSSRAddress],
        log: true,
    });
};

deploy.tags = ["LaserMasterGuard"];
deploy.runAtTheEnd = true;

export default deploy;
