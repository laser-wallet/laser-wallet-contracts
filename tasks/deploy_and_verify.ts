import "hardhat-deploy";
import { task } from "hardhat/config";
import { LaserFactory__factory } from "../typechain-types";

task("deploy-and-verify", "Deploys all Laser contracts and verifies them on Etherscan").setAction(async (_, hre) => {
    await hre.run("deploy");

    const { LaserWallet, LaserFactory, LaserHelper } = await hre.deployments.all();
    const networkName = hre.network.name;

    await hre.run("verify:verify", {
        address: LaserWallet.address,
    });

    await hre.run("verify:verify", {
        address: LaserFactory.address,
        constructorArguments: [LaserWallet.address],
    });

    await hre.run("verify:verify", {
        address: LaserHelper.address,
    });
});
