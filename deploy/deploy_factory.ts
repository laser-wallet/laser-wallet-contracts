const { ethers } = require("hardhat");
import { deploySingleton } from "./deploy_singleton";
import { setTimeout } from "timers/promises";


export async function deployFactory(): Promise<void> {
    const [deployer] = await ethers.getSigners();
    
    const singleton = await deploySingleton();

    const _LaserProxyFactory = await ethers.getContractFactory("LaserProxyFactory");

    await setTimeout(30000);

    console.log("deploying the factory ....");
    const LaserProxyFactory = await _LaserProxyFactory.deploy(singleton);

    console.log("factory deployed ...", LaserProxyFactory.address);
}


deployFactory();