import "hardhat-deploy";
import { task } from "hardhat/config";
import { LaserFactory__factory } from "../typechain-types";

task(
    "deploy-and-verify",
    "Deploys the mastercopy 'LaserWallet', the factory 'LaserFactory', and verifies them on Etherscan"
).setAction(async (_, hre) => {
    // We deploy the contracts.
    // The first contract to deploy is LaserWallet, this is because the factory takes the
    // address of LaserWallet as a constructor argument.
    await hre.run("deploy");

    const { LaserWallet, LaserFactory } = await hre.deployments.all();
    const networkName = hre.network.name;

    // We first verify LaserWallet.sol
    await hre.run("verify:verify", {
        address: LaserWallet.address,
    });

    // Then LaserFactory.sol
    await hre.run("verify:verify", {
        address: LaserFactory.address,
        constructorArguments: [LaserWallet.address],
    });
});
