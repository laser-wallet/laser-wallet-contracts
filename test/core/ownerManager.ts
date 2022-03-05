import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import { encodeFunctionData, addressZero, SENTINEL, signMessage, fakeSignature, paddedSignature} from "../utils";
import { Domain, types, TxMessage, SafeTx } from "../types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("OwnerManager", () => {
    let specialOwner: Wallet;
    let owner2: Wallet;
    let owner3: Wallet;
    let owner4: Wallet;
    let signer: Signer;
    let wallet: Contract;
    let threshold: number;
    let owners: string[];
    let specialOwners: string[];
    let domain:Domain;
    let signature: string;
    let safeTx: SafeTx;

    beforeEach(async () => {
        // In order to sign typed data, we need to use Wallet instead of signers. 
        // The accounts are the first 4 deterministic accounts of Harhdat
        specialOwner = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        owner2 = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        owner3 = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
        owner4 = new ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
        threshold = 3;
        const LaserWallet = await ethers.getContractFactory("LaserWallet");
        const singleton = await LaserWallet.deploy();
        const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
        const proxyFactory = await ProxyFactory.deploy();
        owners = [specialOwner.address, owner2.address, owner3.address, owner4.address];
        specialOwners = [specialOwner.address];
        const data = encodeFunctionData(abi, "setup", [owners, specialOwners, threshold, SENTINEL]);
        const transaction = await proxyFactory.createProxyWithNonce(singleton.address, data, 1111);
        const receipt = await transaction.wait();
        const walletAddress = receipt.events[1].args.proxy;
        [signer] = await ethers.getSigners();
        wallet = new ethers.Contract(walletAddress, abi, signer);
        domain = {
            chainId: await wallet.getChainId(),
            verifyingContract: wallet.address
        }
        signature = paddedSignature(specialOwner.address);
        // internal tx
        safeTx = {
            to: wallet.address,
            value: 0,
            data: "",
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: addressZero,
            refundReceiver: addressZero,
            signature : signature,
            specialOwner : specialOwner.address
        }
    });

    describe("Correct setup", () => {
        it("should have correct threshold", async () => {
            const _threshold = await wallet.getThreshold();
            expect(_threshold).to.equal(threshold);
        });
        it("should have correct owners and special owners", async () => {
            const _owners = await wallet.getOwners();
            expect(_owners.length).to.equal(owners.length);
            expect(await wallet.isOwner(specialOwner.address)).to.equal(true);
            expect(await wallet.isOwner(owner2.address)).to.equal(true);
            expect(await wallet.isOwner(owner3.address)).to.equal(true);
            expect(await wallet.isOwner(owner4.address)).to.equal(true);
            const _specialOwners = await wallet.getSpecialOwners();
            expect(_specialOwners.length).to.equal(specialOwners.length);
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(true);
        });
        it("should not allow to call setup()", async () => {
            await expect(wallet.setup(owners, specialOwners, threshold, SENTINEL)).to.be.revertedWith("'Wallet already initialized");
        });
    });

    describe("addOwnerWithThreshold()", () => {
        it("should revert by calling the function directly", async () => {
            await expect(wallet.addOwnerWithThreshold(addressZero, 2)).to.be.revertedWith("Only callable from the wallet");
        });
        it("should not accept the safe as owner", async () => {
            const _data = encodeFunctionData(abi, "addOwnerWithThreshold", [wallet.address, 2]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not accept the sentinel as owner", async () => {
            const _data = encodeFunctionData(abi, "addOwnerWithThreshold", [SENTINEL, 2]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not accept the address 0 as owner", async () => {
            const _data = encodeFunctionData(abi, "addOwnerWithThreshold", [addressZero, 2]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not be able to add the same owner twice", async () => {
            const _data = encodeFunctionData(abi, "addOwnerWithThreshold", [specialOwner.address, 2]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not be able to add an owner and change the threshold to 0", async () => {
            const random = ethers.Wallet.createRandom();
            const _data = encodeFunctionData(abi, "addOwnerWithThreshold", [random.address, 0]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not be able to add an owner and change the threshold to larger than the owner count", async () => {
            const random = ethers.Wallet.createRandom();
            const _data = encodeFunctionData(abi, "addOwnerWithThreshold", [random.address, 6]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should emit event when adding a new owner", async () => {
            const random = ethers.Wallet.createRandom();
            const _data = encodeFunctionData(abi, "addOwnerWithThreshold", [random.address, threshold]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "AddedOwner").withArgs(random.address);
        });
         it("should emit event when adding a new owner and changing the threshold", async () => {
            const random = ethers.Wallet.createRandom();
            const _data = encodeFunctionData(abi, "addOwnerWithThreshold", [random.address, 2]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "AddedOwner").withArgs(random.address)
            .and.to.emit(wallet, "ChangedThreshold").withArgs(2);
        });
    });

    describe("removeOwner()", () => {
        it("should revert by calling the function directly", async () => {
            await expect(wallet.removeOwner(SENTINEL, SENTINEL, 1)).to.be.revertedWith("Only callable from the wallet");
        });
        it("should not be able to remove the sentinel", async () => {
            const _data = encodeFunctionData(abi, "removeOwner", [owner4.address, SENTINEL, threshold]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not be able to remove the address 0", async () => {
            const _data = encodeFunctionData(abi, "removeOwner", [owner4.address, addressZero, threshold]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
         });
        it("should revert by providing an invalid prev owner", async () => {
            const _data = encodeFunctionData(abi, "removeOwner", [owner2.address, owner4.address, threshold]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not be able to remove an owner and change the threshold to larger than the owner count", async () => {
            const _data = encodeFunctionData(abi, "removeOwner", [specialOwner.address, owner2.address, 4]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not remove owner and change threshold to 0", async () => {
            const _data = encodeFunctionData(abi, "removeOwner", [specialOwner.address, owner2.address, 0]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("emits correct events when owner removed and threshold changed and fails by trying to remove last owner", async () => {
            expect(await wallet.isOwner(owner2.address)).to.equal(true);
            let _data = encodeFunctionData(abi, "removeOwner", [specialOwner.address, owner2.address, 2]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "RemovedOwner").withArgs(owner2.address)
            .and.to.emit(wallet, "ChangedThreshold").withArgs(2);
            // owner2 should now not be an owner
            expect(await wallet.isOwner(owner2.address)).to.equal(false);
            expect(await wallet.isOwner(owner3.address)).to.equal(true);
            _data = encodeFunctionData(abi, "removeOwner", [specialOwner.address, owner3.address, 1]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "RemovedOwner").withArgs(owner3.address);
            // owner3 should now not be an owner
            expect(await wallet.isOwner(owner3.address)).to.equal(false);
            expect(await wallet.isOwner(owner4.address)).to.equal(true);
            _data = encodeFunctionData(abi, "removeOwner", [specialOwner.address, owner4.address, 1]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "RemovedOwner").withArgs(owner4.address);
            // owner4 should now not be an owner
            expect(await wallet.isOwner(owner4.address)).to.equal(false);
            // should revert by trying to remove last owner.
            _data = encodeFunctionData(abi, "removeOwner", [SENTINEL, specialOwner.address, 1]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should remove the special owner completely and emit events", async () => {
            expect(await wallet.isOwner(specialOwner.address)).to.equal(true);
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(true);
            const _data = encodeFunctionData(abi, "removeOwner", [SENTINEL, specialOwner.address, threshold]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "RemovedSpecialOwner").withArgs(specialOwner.address)
            .and.to.emit(wallet, "RemovedOwner").withArgs(specialOwner.address);
            expect(await wallet.isOwner(specialOwner.address)).to.equal(false);
            expect(await wallet.isOwner(specialOwner.address)).to.equal(false);
        });
    });

    describe("changeThreshold()", () => {
        it("should revert by calling the function directly", async () => {
            await expect(wallet.changeThreshold(1)).to.be.revertedWith("Only callable from the wallet");
        });
        it("should revert by passing a higher threshold than the owner count", async () => {
            const _data = encodeFunctionData(abi, "changeThreshold", [5]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should revert by passing 0 threshold", async () => {
            const _data = encodeFunctionData(abi, "changeThreshold", [0]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should change the threshold and emit event", async () => {
            const initialThreshold = await wallet.getThreshold();
            expect(initialThreshold.toString()).to.equal("3");
            const _data = encodeFunctionData(abi, "changeThreshold", [2]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "ChangedThreshold").withArgs(2);
            const newThreshold = await wallet.getThreshold();
            expect(newThreshold.toString()).to.equal("2");
        });   
    }); 
    // Special Owners are owners that can execute a transaction without further signatures.
    // Their signature is enough to execute any type of transaction. 
    // All special owners are also owners.
    describe("addSpecialOwner()", () => {
        it("should revert by calling the function directly", async () => {
            await expect(wallet.addSpecialOwner(SENTINEL)).to.be.revertedWith("Only callable from the wallet");
        });
        it("should not accept the safe itself", async () => {
            const _data = encodeFunctionData(abi, "addSpecialOwner", [wallet.address]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not accept address 0", async () => {
            const _data = encodeFunctionData(abi, "addSpecialOwner", [addressZero]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not accept the sentinel", async () => {
            const _data = encodeFunctionData(abi, "addSpecialOwner", [SENTINEL]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should not accept a duplicate special owner", async () => {
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(true);
            const _data = encodeFunctionData(abi, "addSpecialOwner", [specialOwner.address]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should add a current owner as a special owner and emit event", async () => {
            expect(await wallet.isOwner(owner2.address)).to.equal(true);
            expect(await wallet.isSpecialOwner(owner2.address)).to.equal(false);
            const _data = encodeFunctionData(abi, "addSpecialOwner", [owner2.address]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "AddedSpecialOwner").withArgs(owner2.address);
            expect(await wallet.isSpecialOwner(owner2.address)).to.equal(true);
        });
        it("should add a not owner as a special owner and also as a regular owner and emit event", async () => {
            const random = ethers.Wallet.createRandom();
            expect(await wallet.isOwner(random.address)).to.equal(false);
            expect(await wallet.isSpecialOwner(random.address)).to.equal(false);
            const _data = encodeFunctionData(abi, "addSpecialOwner", [random.address]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "AddedOwner").withArgs(random.address)
            .and.to.emit(wallet, "AddedSpecialOwner").withArgs(random.address);
            expect(await wallet.isOwner(random.address)).to.equal(true);
            expect(await wallet.isSpecialOwner(random.address)).to.equal(true);
        });
    }); 
    
    describe("removeSpecialOwner()", () => {
        it("should revert by calling the function directly", async () => {
            await expect(wallet.removeSpecialOwner(SENTINEL)).to.be.revertedWith("Only callable from the wallet");
        });
        it("should not accept addresses that are not special owners", async () => {
            let _data = encodeFunctionData(abi, "removeSpecialOwner", [wallet.address]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
            const random = ethers.Wallet.createRandom();
            _data = encodeFunctionData(abi, "removeSpecialOwner", [random.address]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
            _data = encodeFunctionData(abi, "removeSpecialOwner", [SENTINEL]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Execution error");
        });
        it("should remove the special owner and emit event", async () => {
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(true);
            const _data = encodeFunctionData(abi, "removeSpecialOwner", [specialOwner.address]);
            safeTx.data = _data;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "RemovedSpecialOwner").withArgs(specialOwner.address);
            expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(false);
        });
    });

    describe("getSpecialOwners()", () => {
        it("should properly show the current specialOwner", async () => {
            const specialOwners = await wallet.getSpecialOwners();
            expect(specialOwners.length).to.equal(1);
            expect(specialOwners[0]).to.equal(specialOwner.address);
        });
        it("should error out if there are no special owners", async () => {
            const _data = encodeFunctionData(abi, "removeSpecialOwner", [specialOwner.address]);
            safeTx.data = _data;
            await wallet.execTransaction(
            safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
            safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            );
            await expect(wallet.getSpecialOwners()).to.be.revertedWith("There are no special owners");
        });
        it("should update after adding another special owner", async () => {
            const _data = encodeFunctionData(abi, "addSpecialOwner", [owner2.address]);
            safeTx.data = _data;
            await wallet.execTransaction(
            safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
            safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            );
            const specialOwners = await wallet.getSpecialOwners();
            expect(specialOwners.length).to.equal(2);
            expect(specialOwners[0]).to.equal(specialOwner.address);
            expect(specialOwners[1]).to.equal(owner2.address);
        });
    });
});

