import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import { walletSetup, encodeFunctionData, factorySetup, getHash, generateTransaction, sendTx } from "../utils";
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
    let recoveryOwner: Signer;
    let recoveryOwnerAddr: Address;
    let guardians: Address[];
    let _guardian1: Signer;
    let _guardian2: Signer;
    let relayer: Signer;

    beforeEach(async () => {
        [
            owner,
            recoveryOwner,
            _guardian1,
            _guardian2,
            relayer
        ] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwnerAddr = await recoveryOwner.getAddress();
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress()
        ];
    });

    describe("Relayer", () => {
         it("should refund the relayer", async () => {
             const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwnerAddr,
                guardians
            );
            const tx = await generateTransaction();
            const initialBal = await ethers.provider.getBalance(await relayer.getAddress());
            console.log("initial bal -->", initialBal.toString());
            await fundWallet(owner, address);
            tx.callData = "0x";
            const random = ethers.Wallet.createRandom().address;
            tx.to = random;
            tx.value = 1000000;
            tx.nonce = 0;
            const hash = await getHash(wallet, tx);
            tx.signatures = await sign(owner, hash);
            await sendTx(wallet.connect(relayer), tx);

            const postBal = await ethers.provider.getBalance(await relayer.getAddress());
            console.log("post bal -->", postBal.toString());
        });
    });
});
