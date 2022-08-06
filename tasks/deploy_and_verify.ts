import "hardhat-deploy";
import { task } from "hardhat/config";

task("deploy-and-verify", "Deploys all Laser contracts and verifies them on Etherscan").setAction(async (_, hre) => {
    await hre.run("deploy");

    const { LaserWallet, LaserFactory, LaserVault, LaserHelper, LaserRegistry, LaserModuleSSR, LaserMasterGuard } =
        await hre.deployments.all();

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

    await hre.run("verify:verify", {
        address: LaserVault.address,
    });

    await hre.run("verify:verify", {
        address: LaserRegistry.address,
    });

    await hre.run("verify:verify", {
        address: LaserModuleSSR.address,
    });

    await hre.run("verify:verify", {
        address: LaserMasterGuard.address,
    });
});
