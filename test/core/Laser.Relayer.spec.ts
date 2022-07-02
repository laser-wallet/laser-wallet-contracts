import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
    walletSetup,
    encodeFunctionData,
    factorySetup,
    getHash,
    generateTransaction,
    sendTx
} from "../utils";
import { Address } from "../types";
import { addrZero } from "../constants/constants";
import { fundWallet } from "../utils";
import { sign } from "../utils/sign";

const mock = ethers.Wallet.createRandom().address;
const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Setup", () => {
    let owner: Signer;
    let ownerAddress: Address;
    let recoveryOwner1: Signer;
    let recoveryOwner2: Signer;
    let guardians: Address[];
    let _guardian1: Signer;
    let _guardian2: Signer;
    let relayer: Signer;
    let recoveryOwners: Address[];

    beforeEach(async () => {
        [
            owner,
            recoveryOwner1,
            recoveryOwner2,
            _guardian1,
            _guardian2,
            relayer
        ] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwners = [
            await recoveryOwner1.getAddress(),
            await recoveryOwner2.getAddress()
        ];
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress()
        ];
    });

    describe("Relayer", () => {
        it("should refund the relayer", async () => {});
    });

    describe("Gas costs", () => {
        it("should refund the exact amount", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const tx = await generateTransaction();
            tx.to = address;
            tx.callData = "0x";
            tx.value = 10000;
            const hash = await getHash(wallet, tx);
            tx.signatures = await sign(owner, hash);
            tx.gasLimit = 100000;
            await owner.sendTransaction({to: address, value: ethers.utils.parseEther("1000")})
            const relayerAddress = await relayer.getAddress();
            tx.maxPriorityFeePerGas = tx.maxFeePerGas;

            for (let i = 0; i<5; i++) {
                tx.nonce = i;
                const initialBalance = await ethers.provider.getBalance(relayerAddress);
                const transaction = await wallet.connect(relayer).exec(
                    tx.to, 
                    tx.value, 
                    tx.callData, 
                    tx.nonce, 
                    tx.maxFeePerGas, 
                    tx.maxPriorityFeePerGas, 
                    tx.gasLimit, 
                    tx.signatures, 
                    {
                        gasLimit: 100000,
                        gasPrice: tx.maxFeePerGas
                    }
                ); 
                const receipt = await transaction.wait();
                const postBalance = await ethers.provider.getBalance(relayerAddress);
                const total = initialBalance.sub(postBalance);
            }
        });

        it("relayer should not overpay", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );

            console.log(await wallet.getRecoveryOwners());

        });
    });
});


