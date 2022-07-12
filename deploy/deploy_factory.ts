import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const laserWalletAddress = (await deployments.get("LaserWallet")).address;

    await deploy("LaserFactory", {
        from: deployer,
        args: [laserWalletAddress],
        log: true,
    });
};

deploy.tags = ["LaserFactory"];
deploy.runAtTheEnd = true;
export default deploy;
