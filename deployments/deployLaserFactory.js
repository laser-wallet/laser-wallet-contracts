async function main() {

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const factory = await ethers.getContractFactory("LaserProxyFactory");

    const LaserProxyFactory = await factory.deploy();
    
    console.log("LaserProxyFactory address -->", LaserProxyFactory.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
