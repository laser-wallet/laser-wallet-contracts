import "hardhat-deploy";
import { task } from "hardhat/config";

task(
    "deploy-and-verify",
    "Deploys the mastercopy 'LaserWallet', the factory 'LaserProxyFactory', and verifies them on Etherscan"
).setAction(async (_, hre) => {
    // We deploy the contracts.
    // The first contract to deploy is LaserWallet, this is because the factory takes the
    // address of LaserWallet as a constructor argument.
    await hre.run("deploy");

    const { LaserWallet, LaserProxyFactory } = await hre.deployments.all();
    const networkName = hre.network.name;

    const LASER_WALLET_ADDRESS = LaserWallet.address;
    const LASER_PROXY_FACTORY_ADDRESS = LaserProxyFactory.address;

    // We first verify LaserWallet.sol
    await hre.run("verify:verify", {
        address: LASER_WALLET_ADDRESS,
    });

    // Then LaserProxyFactory.sol
    await hre.run("verify:verify", {
        address: LASER_PROXY_FACTORY_ADDRESS,
        constructorArguments: [LASER_WALLET_ADDRESS],
    });
});
