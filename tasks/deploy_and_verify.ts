import { task } from "hardhat/config";

task("deploy-and-verify", "Deploys all Laser contracts and verifies them on Etherscan.").setAction(async (_, hre) => {
    await hre.run("deploy");
    await hre.run("etherscan-verify", { forceLicense: true, license: "LGPL-3.0" });
});

export {};
