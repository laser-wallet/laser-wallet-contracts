
const { SINGLETON_ADDRESS } = require("./constants.js");


async function main() {

    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const LASER_PROXY_FACTORY = await ethers.getContractFactory("LaserProxyFactory");

    const LaserProxyFactory = await LASER_PROXY_FACTORY.deploy(SINGLETON_ADDRESS);
    
    console.log("LaserProxyFactory address -->", LaserProxyFactory.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
