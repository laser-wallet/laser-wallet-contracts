import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
    walletSetup,
    addressesForTest,
    AddressesForTest,
    signersForTest,
    SignersForTest,
    sign,
    initSSR,
} from "../utils";
import { Address } from "../types";

describe("Proxy Factory", () => {
    let addresses: AddressesForTest;
    let signers: SignersForTest;
    let chainId: number;
    let laserModule: Address;
    let laserMasterGuard: Address;
    let laserRegistry: Address;

    beforeEach(async () => {
        await deployments.fixture();
        addresses = await addressesForTest();
        signers = await signersForTest();
        const network = await ethers.provider.getNetwork();
        chainId = network.chainId;

        laserModule = (await deployments.get("LaserModuleSSR")).address;
        laserMasterGuard = (await deployments.get("LaserMasterGuard")).address;
        laserRegistry = (await deployments.get("LaserRegistry")).address;
    });

    describe("Proxy Factory creation and interaction", () => {
        it("should have the singleton stored after deployment", async () => {
            const singleton = await deployments.get("LaserWallet");
            const { factory } = await walletSetup();
            expect(await factory.singleton()).to.equal(singleton.address);
        });

        it("should revert by providing an invalid singleton (EOA)", async () => {
            const randy = ethers.Wallet.createRandom();
            const Factory = await ethers.getContractFactory("LaserFactory");
            await expect(Factory.deploy(randy.address)).to.be.reverted;
        });

        it("should revert by providing an invalid singleton (contract)", async () => {
            const Caller = await ethers.getContractFactory("Caller");
            const caller = await Caller.deploy();
            const Factory = await ethers.getContractFactory("LaserFactory");
            await expect(Factory.deploy(caller.address)).to.be.reverted;
        });

        it("should revert if the owner signs with an invalid chain id", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            const invalidChainId = 1234;
            const abiCoder = new ethers.utils.AbiCoder();
            const dataHash = ethers.utils.keccak256(
                abiCoder.encode(["uint256", "uint256", "uint256", "uint256"], [0, 0, 0, invalidChainId])
            );

            const initData = await initSSR(guardians, recoveryOwners);
            const signature = await sign(ownerSigner, dataHash);

            await expect(
                factory.deployProxyAndRefund(owner, 0, 0, 0, relayer, laserModule, initData, saltNumber, signature)
            ).to.be.reverted;
        });

        it("should deploy a proxy with 'deployProxyAndRefund()'", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            const abiCoder = new ethers.utils.AbiCoder();
            const dataHash = ethers.utils.keccak256(
                abiCoder.encode(["uint256", "uint256", "uint256", "uint256"], [0, 0, 0, chainId])
            );

            const initData = await initSSR(guardians, recoveryOwners);
            const signature = await sign(ownerSigner, dataHash);

            await expect(
                factory.deployProxyAndRefund(
                    owner,
                    0,
                    0,
                    0,
                    relayer,
                    laserModule,
                    laserMasterGuard,
                    laserRegistry,
                    initData,
                    saltNumber,
                    signature
                )
            ).to.emit(factory, "ProxyCreation");
        });

        it("should precompute the proxy address 'precomputeAddress()'", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const { ownerSigner } = signers;

            const abiCoder = new ethers.utils.AbiCoder();
            const dataHash = ethers.utils.keccak256(
                abiCoder.encode(["uint256", "uint256", "uint256", "uint256"], [0, 0, 0, chainId])
            );

            const initData = await initSSR(guardians, recoveryOwners);
            const signature = await sign(ownerSigner, dataHash);

            const tx = await factory.deployProxyAndRefund(
                owner,
                0,
                0,
                0,
                relayer,
                laserModule,
                laserMasterGuard,
                laserRegistry,
                initData,
                saltNumber,
                signature
            );
            const receipt = await tx.wait();
            const address = receipt.events[0].args.proxy;

            const preComputedAddress = await factory.preComputeAddress(owner, laserModule, initData, saltNumber);

            expect(address).to.equal(preComputedAddress);
        });

        it("should return a different address if we change the salt", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const initData = await initSSR(guardians, recoveryOwners);
            const preComputedAddress = await factory.preComputeAddress(owner, laserModule, initData, saltNumber);

            const { ownerSigner } = signers;

            const abiCoder = new ethers.utils.AbiCoder();
            const dataHash = ethers.utils.keccak256(
                abiCoder.encode(["uint256", "uint256", "uint256", "uint256"], [0, 0, 0, chainId])
            );

            const signature = await sign(ownerSigner, dataHash);

            const tx = await factory.deployProxyAndRefund(
                owner,
                0,
                0,
                0,
                relayer,
                laserModule,
                laserMasterGuard,
                laserRegistry,
                initData,
                BigNumber.from(saltNumber).add(1),
                signature
            );
            const receipt = await tx.wait();
            const address = receipt.events[0].args.proxy;

            expect(address).to.not.equal(preComputedAddress);
        });

        it("should return a different address if we change the owner", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const initData = await initSSR(guardians, recoveryOwners);
            const preComputedAddress = await factory.preComputeAddress(
                ethers.Wallet.createRandom().address,
                laserModule,
                initData,
                saltNumber
            );

            const { ownerSigner } = signers;

            const abiCoder = new ethers.utils.AbiCoder();
            const dataHash = ethers.utils.keccak256(
                abiCoder.encode(["uint256", "uint256", "uint256", "uint256"], [0, 0, 0, chainId])
            );

            const signature = await sign(ownerSigner, dataHash);

            const tx = await factory.deployProxyAndRefund(
                owner,
                0,
                0,
                0,
                relayer,
                laserModule,
                laserMasterGuard,
                laserRegistry,
                initData,
                saltNumber,
                signature
            );
            const receipt = await tx.wait();
            const address = receipt.events[0].args.proxy;

            expect(address).to.not.equal(preComputedAddress);
        });

        it("should return a different address if we change a guardain", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const initData = await initSSR(guardians, recoveryOwners);
            const initData2 = await initSSR([ethers.Wallet.createRandom().address], recoveryOwners);
            const preComputedAddress = await factory.preComputeAddress(owner, laserModule, initData2, saltNumber);

            const { ownerSigner } = signers;

            const abiCoder = new ethers.utils.AbiCoder();
            const dataHash = ethers.utils.keccak256(
                abiCoder.encode(["uint256", "uint256", "uint256", "uint256"], [0, 0, 0, chainId])
            );

            const signature = await sign(ownerSigner, dataHash);

            const tx = await factory.deployProxyAndRefund(
                owner,
                0,
                0,
                0,
                relayer,
                laserModule,
                laserMasterGuard,
                laserRegistry,
                initData,
                saltNumber,
                signature
            );
            const receipt = await tx.wait();
            const address = receipt.events[0].args.proxy;

            expect(address).to.not.equal(preComputedAddress);
        });

        it("should return a different address if we change a recovery owner", async () => {
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const initData = await initSSR(guardians, recoveryOwners);
            const initData2 = await initSSR(guardians, [ethers.Wallet.createRandom().address]);
            const preComputedAddress = await factory.preComputeAddress(owner, laserModule, initData2, saltNumber);

            const { ownerSigner } = signers;

            const abiCoder = new ethers.utils.AbiCoder();
            const dataHash = ethers.utils.keccak256(
                abiCoder.encode(["uint256", "uint256", "uint256", "uint256"], [0, 0, 0, chainId])
            );

            const signature = await sign(ownerSigner, dataHash);

            const tx = await factory.deployProxyAndRefund(
                owner,
                0,
                0,
                0,
                relayer,
                laserModule,
                laserMasterGuard,
                laserRegistry,
                initData,
                saltNumber,
                signature
            );
            const receipt = await tx.wait();
            const address = receipt.events[0].args.proxy;

            expect(address).to.not.equal(preComputedAddress);
        });

        it("should revert by deploying the same address twice", async () => {
            // When deploying a contract, the EVM checks if the address has code,
            // if it does, it reverts.
            const { factory } = await walletSetup();
            const { owner, recoveryOwners, guardians, relayer } = await addressesForTest();

            const saltNumber = Math.floor(Math.random() * 100000);

            const initData = await initSSR(guardians, recoveryOwners);
            const preComputedAddress = await factory.preComputeAddress(owner, laserModule, initData, saltNumber);

            const { ownerSigner } = signers;

            const abiCoder = new ethers.utils.AbiCoder();
            const dataHash = ethers.utils.keccak256(
                abiCoder.encode(["uint256", "uint256", "uint256", "uint256"], [0, 0, 0, chainId])
            );

            const signature = await sign(ownerSigner, dataHash);

            // first transaction
            await factory.deployProxyAndRefund(
                owner,
                0,
                0,
                0,
                relayer,
                laserModule,
                laserMasterGuard,
                laserRegistry,
                initData,
                saltNumber,
                signature
            );

            // second transaction
            await expect(
                factory.deployProxyAndRefund(
                    owner,
                    0,
                    0,
                    0,
                    relayer,
                    laserModule,
                    laserMasterGuard,
                    laserRegistry,
                    initData,
                    saltNumber,
                    signature
                )
            ).to.be.reverted;
        });
    });
});
