import { ethers } from "ethers";

// Hardhat account 0
const ownerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const ownerWallet = new ethers.Wallet(ownerPrivateKey);

// Hardhat account 1
const recoveryOwnerPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
export const recoveryOwnerWallet = new ethers.Wallet(recoveryOwnerPrivateKey);

// Hardhat account 2
const guardianPrivateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

export const guardianWallet = new ethers.Wallet(guardianPrivateKey);

export const addrZero = ethers.constants.AddressZero;
