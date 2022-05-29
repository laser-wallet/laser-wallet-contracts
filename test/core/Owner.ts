import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, Signer, Wallet } from 'ethers';
import { walletSetup, encodeFunctionData, factorySetup } from '../utils';
import { Address } from '../types';
import { addrZero } from '../constants/constants';

const mock = ethers.Wallet.createRandom().address;
const { abi } = require('../../artifacts/contracts/LaserWallet.sol/LaserWallet.json');

describe('Owner', () => {
    let owner: Signer;
    let ownerAddress: Address;
    let guardians: Address[];
    let entryPoint: Address;
    let EntryPoint: Contract;
    let _guardian1: Signer;
    let _guardian2: Signer;
    let relayer: Signer;

    beforeEach(async () => {
        [owner, _guardian1, _guardian2, relayer] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        guardians = [await _guardian1.getAddress(), await _guardian2.getAddress()];
        const EP = await ethers.getContractFactory('TestEntryPoint');
        EntryPoint = await EP.deploy(mock, 0, 0);
        entryPoint = EntryPoint.address;
    });

    describe('Owner', async () => {
        it('should have the correct owner', async () => {
            const { address, wallet } = await walletSetup(ownerAddress, guardians, entryPoint);
            expect(await wallet.owner()).to.equal(ownerAddress);
        });

        it('should not allow to init with address0', async () => {
            const LaserWallet = await ethers.getContractFactory('LaserWallet');
            const singleton = await LaserWallet.deploy();
            const singletonAddress = singleton.address;
            const { address, factory } = await factorySetup(singletonAddress);
            const initializer = encodeFunctionData(abi, 'init', [addrZero, guardians, entryPoint]);
            await expect(factory.createProxy(initializer)).to.be.reverted;
        });

        it('should not allow to init with address with code', async () => {
            const LaserWallet = await ethers.getContractFactory('LaserWallet');
            const singleton = await LaserWallet.deploy();
            const singletonAddress = singleton.address;
            const { address, factory } = await factorySetup(singletonAddress);
            const initializer = encodeFunctionData(abi, 'init', [
                entryPoint,
                guardians,
                entryPoint,
            ]);
            await expect(factory.createProxy(initializer)).to.be.reverted;
        });

        it('should revert by changing the owner to address0', async () => {
            const { address, wallet } = await walletSetup(ownerAddress, guardians, entryPoint);
            const txData = encodeFunctionData(abi, 'changeOwner', [addrZero]);
            await expect(wallet.exec(address, 0, txData)).to.be.reverted;
        });

        it('should revert by changing the owner to an address with code', async () => {
            const { address, wallet } = await walletSetup(ownerAddress, guardians, entryPoint);
            const txData = encodeFunctionData(abi, 'changeOwner', [entryPoint]);
            await expect(wallet.exec(address, 0, txData)).to.be.reverted;
        });

        it('should revert by changing the owner to the current owner', async () => {
            const { address, wallet } = await walletSetup(ownerAddress, guardians, entryPoint);
            const owner = await wallet.owner();
            const txData = encodeFunctionData(abi, 'changeOwner', [owner]);
            await expect(wallet.exec(address, 0, txData)).to.be.reverted;
        });

        it('should change the owner and emit event', async () => {
            const { address, wallet } = await walletSetup(ownerAddress, guardians, entryPoint);
            expect(await wallet.owner()).to.equal(ownerAddress);
            const txData = encodeFunctionData(abi, 'changeOwner', [mock]);
            await expect(wallet.exec(address, 0, txData))
                .to.emit(wallet, 'OwnerChanged')
                .withArgs(mock);
            expect(await wallet.owner()).to.equal(mock);
        });
    });
});
