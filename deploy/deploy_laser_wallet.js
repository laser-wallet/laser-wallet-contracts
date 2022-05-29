const hre = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contract with the account:", deployer.address);

    const LASER_WALLET = await ethers.getContractFactory("LaserWallet");

    const LaserWallet = await LASER_WALLET.deploy();

    console.log("LaserWallet address -->", LaserWallet.address);

    await hre.storageLayout.export();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
