import { ethers } from "hardhat";

export const addrZero = ethers.constants.AddressZero;

// owner address zero (hardhat deterministic 0 account).
const ownerPk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const ownerWallet = new ethers.Wallet(ownerPk);
