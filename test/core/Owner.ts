import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import { walletSetup, encodeFunctionData, factorySetup } from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";

const mock = ethers.Wallet.createRandom().address;
const {
    abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Owner", () => {
    let owner: Signer;
    let ownerAddress: Address;
    let recoveryOwner: Signer;
    let recoveryOwnerAddr: Address;
    let guardians: Address[];
    let _guardian1: Signer;
    let _guardian2: Signer;
    let relayer: Signer;

    beforeEach(async () => {
        [owner, recoveryOwner, _guardian1, _guardian2, relayer] =
            await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwnerAddr = await recoveryOwner.getAddress();
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress(),
        ];
    });

    describe("Owner", async () => {
        it("should have the correct owner", async () => {
             const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians
            );
            expect(await wallet.owner()).to.equal(ownerAddress);
        });

        it("should not allow to init with address0", async () => {
            const LaserWallet = await ethers.getContractFactory("LaserWallet");
            const singleton = await LaserWallet.deploy();
            const singletonAddress = singleton.address;
            const { address, factory } = await factorySetup(singletonAddress);
            const initializer = encodeFunctionData(abi, "init", [
                addrZero,
                recoveryOwnerAddr,
                guardians
                        ]);
            await expect(factory.createProxy(initializer)).to.be.reverted;
        });

        it("should not allow to init with address with code", async () => {
            const LaserWallet = await ethers.getContractFactory("LaserWallet");
            const singleton = await LaserWallet.deploy();
            const singletonAddress = singleton.address;
            const { address, factory } = await factorySetup(singletonAddress);
            const initializer = encodeFunctionData(abi, "init", [
                address,
                recoveryOwnerAddr,
                guardians,
            ]);
            await expect(factory.createProxy(initializer)).to.be.reverted;
        });

        it("should revert by changing the owner to address0", async () => {
             const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians
            );
            const txData = encodeFunctionData(abi, "changeOwner", [addrZero]);
            
            const hash = await wallet.operationHash(address, 0, txData)
            await expect(wallet.exec(address, 0, txData)).to.be.reverted;
        });

        // it("should revert by changing the owner to an address with code", async () => {
        //     const { address, wallet } = await walletSetup(
        //         ownerAddress,
        //         recoveryOwnerAddr,
        //         guardians,
        //         entryPoint
        //     );
        //     const txData = encodeFunctionData(abi, "changeOwner", [entryPoint]);
        //     await expect(wallet.exec(address, 0, txData)).to.be.reverted;
        // });

        // it("should revert by changing the owner to the current owner", async () => {
        //     const { address, wallet } = await walletSetup(
        //         ownerAddress,
        //         recoveryOwnerAddr,
        //         guardians,
        //         entryPoint
        //     );
        //     const owner = await wallet.owner();
        //     const txData = encodeFunctionData(abi, "changeOwner", [owner]);
        //     await expect(wallet.exec(address, 0, txData)).to.be.reverted;
        // });

        // it("should change the owner and emit event", async () => {});
    });

    describe("Recovery owner", () => {});
});
