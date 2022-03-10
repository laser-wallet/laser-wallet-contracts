import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer, Wallet } from "ethers";

import { encodeFunctionData, addressZero, SENTINEL, signMessage, fakeSignature, paddedSignature} from "../utils";
import { Domain, types, TxMessage, SafeTx } from "../types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");


describe("Signatures", () => {
    let owner1: Wallet;
    let owner2: Wallet;
    let relayer: Signer;
    let owner1Address: string;
    let owner2Address: string;
    let relayerAddress: string;
    let wallet: Contract;
    let domain: Domain;
    let txMessage: TxMessage;
    let threshold: number;
    let safeTx: SafeTx;
    let singleton: Contract;
    let _data: string;

    beforeEach(async () => {
        owner1 = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        owner2 = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
        owner1Address = await owner1.getAddress();
        owner2Address = await owner2.getAddress();
        const owners = [owner1Address, owner2Address];
        const specialOwners = [owner2Address];
        threshold = 2;
        const accounts = await ethers.getSigners();
        relayer = accounts[10];
        relayerAddress = await relayer.getAddress();
        const LaserWallet = await ethers.getContractFactory("LaserWallet");
        // Deploying the base contract (implementation contract). To delegate all calls.
        singleton = await LaserWallet.deploy();

        // proxy factory
        const ProxyFactory = await ethers.getContractFactory("LaserProxyFactory");
        // Deploying the proxy factory to create proxies.
        const proxyFactory = await ProxyFactory.deploy();
        
        const data = encodeFunctionData(abi, "setup", [owners, specialOwners, threshold, SENTINEL]);

        const transaction = await proxyFactory.createProxyWithNonce(singleton.address, data, 1111);
        const receipt = await transaction.wait();
        const walletAddress = receipt.events[1].args.proxy;

        wallet = new ethers.Contract(walletAddress, abi, relayer);

        safeTx = {
            to: wallet.address,
            value: 0,
            data: "0x",
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: addressZero,
            refundReceiver: addressZero,
            signature : "",
            specialOwner : ""
        }

        txMessage = {
            to: wallet.address,
            value: 0,
            data: "0x",
            operation: 0,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: addressZero,
            refundReceiver: addressZero,
            nonce: await wallet.nonce()
        }

        domain = {
            chainId: await wallet.getChainId(),
            verifyingContract: wallet.address
        }
        // this is calldata to change the threshold. To use it as main example.
        _data = encodeFunctionData(abi, "changeThreshold", [1]);
    });

    describe("Correct setup", () => {
        it("should have correct threshold", async () => {
            const _threshold = await wallet.getThreshold();
            expect(_threshold).to.equal(threshold);
        });
        it("should have correct owners and special owners", async () => {
            const _owners = await wallet.getOwners();
            expect(_owners.length).to.equal(2);
            expect(await wallet.isOwner(owner1Address)).to.equal(true);
            expect(await wallet.isOwner(owner2Address)).to.equal(true);
            expect(await wallet.isSpecialOwner(owner1Address)).to.equal(false);
            expect(await wallet.isSpecialOwner(owner2Address)).to.equal(true);
            expect(await wallet.isOwner(relayerAddress)).to.equal(false);
        });
    });

    describe("Correct data", () => {
        it("should have correct domain separator", async () => {
            const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain({
                verifyingContract: wallet.address, chainId: await wallet.getChainId()
            });
            expect(domainSeparator).to.equal(await wallet.domainSeparator());
        });
        it("should correctly calculate the transaction hash", async () => {
            const transactionHash = ethers.utils._TypedDataEncoder.hash({
                verifyingContract: wallet.address, chainId: await wallet.getChainId()
            }, types, txMessage
            );
            const _transactionHash = await wallet.getTransactionHash(
                txMessage.to, txMessage.value, txMessage.data, txMessage.operation, 
                txMessage.safeTxGas, txMessage.baseGas, txMessage.gasPrice, txMessage.gasToken, 
                txMessage.refundReceiver, txMessage.nonce
            );
            expect(transactionHash).to.equal(_transactionHash);
        });
        it("should have correct chain id", async () => {
            const { chainId } = await ethers.provider.getNetwork();
            expect(chainId).to.equal(await wallet.getChainId());
        });
    });

    describe("approveHash", () => {
        it("should revert, only owners can approve a hash", async () => {
            txMessage.data = _data;
            const hash = await wallet.getTransactionHash(
                txMessage.to, txMessage.value, txMessage.data, txMessage.operation, 
                txMessage.safeTxGas, txMessage.baseGas, txMessage.gasPrice, txMessage.gasToken, 
                txMessage.refundReceiver, txMessage.nonce
            );
            await expect(wallet.approveHash(hash)).to.be.revertedWith("Only owners can approve a hash");
        });
        it("should approve hash and emit event", async () => {
            txMessage.data = _data;
            const hash = await wallet.getTransactionHash(
                txMessage.to, txMessage.value, txMessage.data, txMessage.operation, 
                txMessage.safeTxGas, txMessage.baseGas, txMessage.gasPrice, txMessage.gasToken, 
                txMessage.refundReceiver, txMessage.nonce
            );
            // owner1 is signer 0.
            const accounts = await ethers.getSigners();
            const _owner1 = accounts[0];
            await expect(
                wallet.connect(_owner1).approveHash(hash)
            ).to.emit(wallet, "ApproveHash").withArgs(hash, owner1Address);
        });
    });

    describe("Special Owner", () => {
        it("should exec a transaction by an approved hash", async () => {
            expect(await wallet.getThreshold()).to.equal(2);
            txMessage.data = _data;
            const hash = await wallet.getTransactionHash(
                txMessage.to, txMessage.value, txMessage.data, txMessage.operation, 
                txMessage.safeTxGas, txMessage.baseGas, txMessage.gasPrice, txMessage.gasToken, 
                txMessage.refundReceiver, txMessage.nonce
            );
            // owner2 is signer 1.
            const accounts = await ethers.getSigners();
            const _owner2 = accounts[1];
            await expect(
                wallet.connect(_owner2).approveHash(hash)
            ).to.emit(wallet, "ApproveHash").withArgs(hash, owner2Address);
            safeTx.value = 0;
            safeTx.data  = _data;
            // v = 1. Hash already approved, relayer can submit transaction.
            safeTx.signature = paddedSignature(owner2Address);
            safeTx.specialOwner = owner2Address;
            await wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            );
            expect(await wallet.getThreshold()).to.equal(1);
        });
        it("should exec a transaction by being msg.sender", async () => {
            expect(await wallet.getThreshold()).to.equal(2);
            safeTx.to = wallet.address;
            safeTx.value = 0;
            safeTx.data  = _data;
            // v = 1. There needs to be approved hashes or the special owner needs to be msg.sender
            safeTx.signature = paddedSignature(owner2Address);
            safeTx.specialOwner = owner2Address;
            // owner2 is signer 1.
            const accounts = await ethers.getSigners();
            const _owner2 = accounts[1];
            await wallet.connect(_owner2).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            );
            expect(await wallet.getThreshold()).to.equal(1);
        });
        it("should exec a transaction through eip712 signing", async () => {
            expect(await wallet.getThreshold()).to.equal(2);
            // creating the message to sign
            txMessage.data = _data;

            // signing the transaction eip712 compliant
            const txSignature = await owner2._signTypedData(domain, types, txMessage);

             // generating the transaction
             safeTx.data = _data;
             safeTx.signature = txSignature;
             safeTx.specialOwner = owner2Address;

              // executing the transaction
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.emit(wallet, "ExecutionSuccess");
            expect(await wallet.getThreshold()).to.equal(1);
        });
        it("v is greater than 30 (eth _ sign)", async () => {
            // special owner i owner2Address
            const _data = encodeFunctionData(abi, "changeThreshold", [1]);
            const hash = await wallet.getTransactionHash(
                wallet.address, 0, _data, 0, 0, 0, 0, addressZero, addressZero, 
                0
            );
            const typedDataHash = ethers.utils.arrayify(hash);
            const sig = (await owner2.signMessage(typedDataHash)).replace(/1b$/, "1f").replace(/1c$/, "20");
            await wallet.execTransaction(
                wallet.address, 0, _data, 0, 0, 0, 0, addressZero, addressZero, 
                sig, owner2Address
            );
        });
        it("should fail by impersonating a special owner", async () => {
            safeTx.data  = _data;
            safeTx.signature = paddedSignature(owner2Address);
            safeTx.specialOwner = owner2Address;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Incorrect owner and/or hash not approved");
        });
        it("should fail if a regular owner tries to exec a transaction with lower threshold", async () => {
            safeTx.data  = _data;
            safeTx.signature = paddedSignature(owner1Address);
            safeTx.specialOwner = addressZero;
            // owner1 is signer 0.
            const accounts = await ethers.getSigners();
            const _owner1 = accounts[0];
            await expect(wallet.connect(_owner1).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Incorrect signature length");
        });
        it("should fail if a regular owner tries to impersonate a special owner", async () => {
            safeTx.data  = _data;
            safeTx.signature = paddedSignature(owner1Address);
            safeTx.specialOwner = owner2Address;
            // owner1 is signer 0.
            const accounts = await ethers.getSigners();
            const _owner1 = accounts[0];
            await expect(wallet.connect(_owner1).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Incorrect special owner");
        });
        it("should fail by signing with incorrect domain address", async () => {
            const _domain = {
                chainId: await wallet.getChainId(),
                verifyingContract: singleton.address
            }
            // creating the message to sign
            txMessage.data = _data;
            // If we sign a transaction with incorrect data, another "signer" will show.
            const txSignature = await owner2._signTypedData(_domain, types, txMessage);

            // generating the transaction
            safeTx.data = _data;
            safeTx.signature = txSignature;
            safeTx.specialOwner = owner2Address;

             // executing the transaction
           await expect(wallet.execTransaction(
               safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
               safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
           )).to.be.revertedWith("Incorrect special owner");
        });
        it("should fail by signing with incorrect chainId", async () => {
            const _domain = {
                chainId: 2,
                verifyingContract: wallet.address
            }
            // creating the message to sign
            txMessage.data = _data;

            // If we sign a transaction with incorrect data, another "signer" will show.
            const txSignature = await owner2._signTypedData(_domain, types, txMessage);

            // generating the transaction
            safeTx.data = _data;
            safeTx.signature = txSignature;
            safeTx.specialOwner = owner2Address;

             // executing the transaction
           await expect(wallet.execTransaction(
               safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
               safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
           )).to.be.revertedWith("Incorrect special owner");
        });
        it("should fail by signing with an incorrect nonce", async () => {
            txMessage.data = _data;
            txMessage.nonce = 1;
            const txSignature = await owner2._signTypedData(domain, types, txMessage);
            safeTx.data = _data;
            safeTx.signature = txSignature;
            safeTx.specialOwner = owner2Address;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Incorrect special owner");
        });
        it("should fail if signature is too short", async () => {
            const sig = "0x000000000000000000000070997970C51812dc3A010C7d01b50e0d17dc79C8000000000000000000000000000000000000000000000000000000000000000001";
            safeTx.data  = _data;
            safeTx.signature = sig;
            safeTx.specialOwner = owner2Address;
            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Incorrect signature length");
        });
    });

    describe("Owners", () => {
        it("should exec transactions by approved hashes", async () => {
            expect(await wallet.getThreshold()).to.equal(2);
            txMessage.data = _data;
            const hash = await wallet.getTransactionHash(
                txMessage.to, txMessage.value, txMessage.data, txMessage.operation, 
                txMessage.safeTxGas, txMessage.baseGas, txMessage.gasPrice, txMessage.gasToken, 
                txMessage.refundReceiver, txMessage.nonce
            );
            const [ _owner1, _owner2] = await ethers.getSigners();
            await expect(
                wallet.connect(_owner1).approveHash(hash)
            ).to.emit(wallet, "ApproveHash").withArgs(hash, owner1Address);
            await expect(
                wallet.connect(_owner2).approveHash(hash)
            ).to.emit(wallet, "ApproveHash").withArgs(hash, owner2Address);
            safeTx.data = _data;
            //owner2 address < owner1 address.
            safeTx.signature = paddedSignature(owner2Address) + (paddedSignature(owner1Address)).slice(2);
            safeTx.specialOwner = addressZero;
            await wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            );
            expect(await wallet.getThreshold()).to.equal(1);
        });
        it("last owner should exec a transaction by being msg.sender", async () => {
            expect(await wallet.getThreshold()).to.equal(2);
            txMessage.data = _data;
            const hash = await wallet.getTransactionHash(
                txMessage.to, txMessage.value, txMessage.data, txMessage.operation, 
                txMessage.safeTxGas, txMessage.baseGas, txMessage.gasPrice, txMessage.gasToken, 
                txMessage.refundReceiver, txMessage.nonce
            );
            const [ _owner1, _owner2] = await ethers.getSigners();
            // first owner approving hash.
            await expect(
                wallet.connect(_owner1).approveHash(hash)
            ).to.emit(wallet, "ApproveHash").withArgs(hash, owner1Address);
            safeTx.data = _data;
            //owner2 address < owner1 address.
            safeTx.signature = paddedSignature(owner2Address) + (paddedSignature(owner1Address)).slice(2);
            safeTx.specialOwner = addressZero;
            // owner2 is msg.sender.
            await wallet.connect(_owner2).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            );
            expect(await wallet.getThreshold()).to.equal(1);
        });
        it("should exec a transaction through eip712 signing", async () => {
            expect(await wallet.getThreshold()).to.equal(2);
            txMessage.data = _data;
            const owner1Sig = await owner1._signTypedData(domain, types, txMessage);
            const owner2Sig = await owner2._signTypedData(domain, types, txMessage);
            const sigs = owner2Sig + owner1Sig.slice(2);

            // generating the transaction
            safeTx.data = _data;
            safeTx.signature = sigs;
            safeTx.specialOwner = addressZero;

            await wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            );
            expect(await wallet.getThreshold()).to.equal(1);
        });
        it("should exec a transaction with different signatures schemes", async () => {
            const [_owner1, _owner2] = await ethers.getSigners();
            expect(await wallet.getThreshold()).to.equal(2);
            txMessage.data = _data;
            
            // owner 1 signs throug eip712
            const owner1Sig = await owner1._signTypedData(domain, types, txMessage);
            // msg.sender signature
            const owner2Sig = paddedSignature(owner2Address);
            const sigs = owner2Sig + owner1Sig.slice(2);

             // generating the transaction
             safeTx.data = _data;
             safeTx.signature = sigs;
             safeTx.specialOwner = addressZero;

             await wallet.connect(_owner2).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            );

            expect(await wallet.getThreshold()).to.equal(1);

        });
        it("should fail by impersonating owner2", async () => {
            const [_owner1] = await ethers.getSigners();
            txMessage.data = _data;
            const owner1Sig = await _owner1._signTypedData(domain, types, txMessage);
            const owner2Sig = paddedSignature(owner2Address);
            const sigs = owner2Sig + owner1Sig.slice(2);
            // generating the transaction
            safeTx.data = _data;
            safeTx.signature = sigs;
            safeTx.specialOwner = addressZero;
            await expect(wallet.connect(_owner1).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Incorrect owner and/or hash not approved");

        });
        it("should fail by repeating signature", async () => {
            const [_owner1] = await ethers.getSigners();
            txMessage.data = _data;
            const sigs = paddedSignature(owner1Address) + (paddedSignature(owner1Address)).slice(2);
            // generating the transaction
            safeTx.data = _data;
            safeTx.signature = sigs;
            safeTx.specialOwner = addressZero;
            await expect(wallet.connect(_owner1).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Invalid owner provided");
        });
        it("should fail by repeating owner signature (different schemes)", async () => {
            const [_owner1] = await ethers.getSigners();
            // approving hash
            txMessage.data = _data;
            const hash = await wallet.getTransactionHash(
                txMessage.to, txMessage.value, txMessage.data, txMessage.operation, 
                txMessage.safeTxGas, txMessage.baseGas, txMessage.gasPrice, txMessage.gasToken, 
                txMessage.refundReceiver, txMessage.nonce
            );
            await expect(
                wallet.connect(_owner1).approveHash(hash)
            ).to.emit(wallet, "ApproveHash").withArgs(hash, owner1Address);
            const sigs = paddedSignature(owner1Address) + (paddedSignature(owner1Address)).slice(2);
            safeTx.data = _data;
            safeTx.signature = sigs;
            safeTx.specialOwner = addressZero;
            await expect(wallet.connect(_owner1).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Invalid owner provided");
        });
        it("should fail to impersonate owner2 as special owner", async () => {
            const [_owner1] = await ethers.getSigners();
            const fakeSig = paddedSignature(owner2Address);
            safeTx.data = _data;
            safeTx.signature = fakeSig;
            safeTx.specialOwner = owner2Address;
            await expect(wallet.connect(_owner1).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Incorrect owner and/or hash not approved");
        });
        it("should fail: signatures not in correct order", async () => {
            const [_owner1] = await ethers.getSigners();

            txMessage.data = _data;
            
            const owner2Sig = await owner2._signTypedData(domain, types, txMessage);
            // msg.sender signature
            const owner1Sig = paddedSignature(owner1Address);
            const sigs = owner1Sig + owner2Sig.slice(2);

            // generating the transaction
            safeTx.data = _data;
            safeTx.signature = sigs;
            safeTx.specialOwner = addressZero;

            await expect(wallet.connect(_owner1).execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Invalid owner provided");
        });
        it("should fail if owners sign different data", async () => {
            txMessage.data = _data;
            const owner1Sig = await owner1._signTypedData(domain, types, txMessage);
            txMessage.data = encodeFunctionData(abi, "changeThreshold", [2]);
            const owner2Sig = await owner2._signTypedData(domain, types, txMessage);
            const sigs = owner2Sig + owner1Sig.slice(2);

            // generating the transaction
            safeTx.data = _data;
            safeTx.signature = sigs;
            safeTx.specialOwner = addressZero;

            await expect(wallet.execTransaction(
                safeTx.to, safeTx.value, safeTx.data, safeTx.operation, safeTx.safeTxGas, safeTx.baseGas, 
                safeTx.gasPrice, safeTx.gasToken, safeTx.refundReceiver, safeTx.signature, safeTx.specialOwner
            )).to.be.revertedWith("Invalid owner provided");
        });
    });
});