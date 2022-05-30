import { ethers } from "ethers";

// Hardhat account 0
const ownerPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const ownerWallet = new ethers.Wallet(ownerPrivateKey);

export const twoEth = ethers.utils.parseEther("2");

export const tenEth = ethers.utils.parseEther("10");

export const addrZero = ethers.constants.AddressZero;
