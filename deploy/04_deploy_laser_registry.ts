import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const laserSSRAddress = (await deployments.get("LaserModuleSSR")).address;
    const laserWalletAddress = (await deployments.get("LaserWallet")).address;
    const laserVaultAddress = (await deployments.get("LaserVault")).address;

    await deploy("LaserRegistry", {
        from: deployer,
        args: [deployer, laserWalletAddress, [laserSSRAddress, laserVaultAddress]],
        log: true,
    });
};

deploy.tags = ["LaserRegistry"];

export default deploy;
