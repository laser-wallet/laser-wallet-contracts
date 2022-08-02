import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    await deploy("LaserRegistry", {
        from: deployer,
        args: [deployer],
        log: true,
    });
};

deploy.tags = ["LaserRegistry"];
export default deploy;
