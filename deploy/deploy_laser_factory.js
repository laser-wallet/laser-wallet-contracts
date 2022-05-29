const ADDRESS_BOOK = {
    MAINNET: {},

    GOERLI: {
        SINGLETON: "0x9459797D2568CBC08D711E63bF73cDbbF6a9055E",
        FACTORY: "0xcCed5B88f14f1e133680117d01dEFeB38fC9a5A3",
    },
};

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const LASER_PROXY_FACTORY = await ethers.getContractFactory("LaserProxyFactory");

    const LaserProxyFactory = await LASER_PROXY_FACTORY.deploy(
        "0x9459797D2568CBC08D711E63bF73cDbbF6a9055E"
    );

    console.log("LaserProxyFactory address -->", LaserProxyFactory.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
