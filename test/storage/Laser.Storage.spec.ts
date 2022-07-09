import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract } from "ethers";
import { walletSetup } from "../utils";
import { Address } from "../types";

async function getStorageSlot(address: Address, n: string): Promise<string> {
    const slot = `0x000000000000000000000000000000000000000000000000000000000000000${n}`;

    return ethers.provider.send("eth_getStorageAt", [address, slot]);
}

describe("Contract Storage", () => {
    beforeEach(async () => {
        await deployments.fixture();
    });

    it("should have the singleton at storage slot 0", async () => {
        const { address, wallet } = await walletSetup();
        const slot0 = await getStorageSlot(address, "0");
        const singleton = await wallet.singleton();

        // last 20 bytes.
        expect(singleton.toLowerCase()).to.equal(`0x${slot0.slice(26)}`);
    });

    it("should have the owner at storage slot 1", async () => {
        const { address, wallet } = await walletSetup();
        const slot1 = await getStorageSlot(address, "1");
        const owner = await wallet.owner();

        // last 20 bytes.
        expect(owner.toLowerCase()).to.equal(`0x${slot1.slice(26)}`);
    });

    it("should have recoveryOwnerCount at storage slot 2", async () => {
        const { address, wallet } = await walletSetup();
        const slot2 = await getStorageSlot(address, "2");

        const recoveryOwners = await wallet.getRecoveryOwners();
        const recoveryOwnerCount = recoveryOwners.length;

        expect(recoveryOwnerCount.toString()).to.equal(slot2.slice(slot2.length - 1));
    });

    it("should have guardianCount at storage slot 3", async () => {
        const { address, wallet } = await walletSetup();
        const slot3 = await getStorageSlot(address, "3");

        const guardians = await wallet.getGuardians();
        const guardianCount = guardians.length;

        expect(guardianCount.toString()).to.equal(slot3.slice(slot3.length - 1));
    });

    it("should have timeLock at storage slot 4", async () => {
        const { address, wallet } = await walletSetup();
        const slot4 = await getStorageSlot(address, "4");

        expect(slot4.toString()).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });
});
