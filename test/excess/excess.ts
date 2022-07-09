import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { walletSetup } from "../utils";

describe("Testing with a lot of signers", () => {
    beforeEach(async () => {
        await deployments.fixture();
    });

    it("should init with 10 recovery owners", async () => {
        let recoveryOwners = [];
        for (let i = 0; i < 10; i++) {
            const recoveryOwner = ethers.Wallet.createRandom().address;
            recoveryOwners.push(recoveryOwner);
        }

        const { address, wallet } = await walletSetup(undefined, recoveryOwners);
        expect(JSON.stringify(await wallet.getRecoveryOwners())).to.equal(JSON.stringify(recoveryOwners));
    });

    it("should init with 50 recovery owners", async () => {
        let recoveryOwners = [];
        for (let i = 0; i < 50; i++) {
            const recoveryOwner = ethers.Wallet.createRandom().address;
            recoveryOwners.push(recoveryOwner);
        }

        const { address, wallet } = await walletSetup(undefined, recoveryOwners);
        expect(JSON.stringify(await wallet.getRecoveryOwners())).to.equal(JSON.stringify(recoveryOwners));
    });

    it("should init with 100 recovery owners", async () => {
        let recoveryOwners = [];
        for (let i = 0; i < 100; i++) {
            const recoveryOwner = ethers.Wallet.createRandom().address;
            recoveryOwners.push(recoveryOwner);
        }

        const { address, wallet } = await walletSetup(undefined, recoveryOwners);
        expect(JSON.stringify(await wallet.getRecoveryOwners())).to.equal(JSON.stringify(recoveryOwners));
    });

    it("should init with 200 recovery owners", async () => {
        let recoveryOwners = [];
        for (let i = 0; i < 200; i++) {
            const recoveryOwner = ethers.Wallet.createRandom().address;
            recoveryOwners.push(recoveryOwner);
        }

        const { address, wallet } = await walletSetup(undefined, recoveryOwners);
        expect(JSON.stringify(await wallet.getRecoveryOwners())).to.equal(JSON.stringify(recoveryOwners));
    });

    it("should init with 10 guardians", async () => {
        let guardians = [];
        for (let i = 0; i < 10; i++) {
            const guardian = ethers.Wallet.createRandom().address;
            guardians.push(guardian);
        }

        const { address, wallet } = await walletSetup(undefined, undefined, guardians);
        expect(JSON.stringify(await wallet.getGuardians())).to.equal(JSON.stringify(guardians));
    });

    it("should init with 50 guardians", async () => {
        let guardians = [];
        for (let i = 0; i < 50; i++) {
            const guardian = ethers.Wallet.createRandom().address;
            guardians.push(guardian);
        }

        const { address, wallet } = await walletSetup(undefined, undefined, guardians);
        expect(JSON.stringify(await wallet.getGuardians())).to.equal(JSON.stringify(guardians));
    });

    it("should init with 100 guardians", async () => {
        let guardians = [];
        for (let i = 0; i < 100; i++) {
            const guardian = ethers.Wallet.createRandom().address;
            guardians.push(guardian);
        }

        const { address, wallet } = await walletSetup(undefined, undefined, guardians);
        expect(JSON.stringify(await wallet.getGuardians())).to.equal(JSON.stringify(guardians));
    });

    it("should init with 200 guardians", async () => {
        let guardians = [];
        for (let i = 0; i < 200; i++) {
            const guardian = ethers.Wallet.createRandom().address;
            guardians.push(guardian);
        }

        const { address, wallet } = await walletSetup(undefined, undefined, guardians);
        expect(JSON.stringify(await wallet.getGuardians())).to.equal(JSON.stringify(guardians));
    });
});
