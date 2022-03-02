async function main() {

    // Deploy Alpha Safe
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const factory = await ethers.getContractFactory("LaserProxyFactory");
    const laserProxyFactory = await factory.deploy();
    console.log("laser factory address -->", laserProxyFactory.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
