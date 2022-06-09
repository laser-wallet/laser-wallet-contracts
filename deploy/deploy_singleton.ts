const { ethers } = require("hardhat");


export async function deploySingleton(): Promise<string> {
    const [deployer] = await ethers.getSigners();
    
    const _LaserWallet = await ethers.getContractFactory("LaserWallet");

    console.log("deploying the singleton ....");

    const LaserWallet = await _LaserWallet.deploy();
    
    console.log("singleton deployed ...", LaserWallet.address);
    
    return LaserWallet.address;
}