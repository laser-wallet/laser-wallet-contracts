const hre = require("hardhat");


async function main() {
    // Deploy Alpha Safe
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const factory = await ethers.getContractFactory("LaserWallet");
    const LaserWallet = await factory.deploy();
    console.log("LaserWallet address -->", LaserWallet.address);
    await hre.storageLayout.export();

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });






