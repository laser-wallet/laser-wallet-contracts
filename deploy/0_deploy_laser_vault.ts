import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const laserSSRAddress = (await deployments.get("LaserModuleSSR")).address;

    await deploy("LaserVault", {
        from: deployer,
        args: [laserSSRAddress],
        log: true,
    });
};

deploy.tags = ["LaserVault"];
export default deploy;
