import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { encodeFunctionData, walletSetup } from "../utils";
import { LaserHelper__factory, LaserHelper, LaserModuleSSR__factory } from "../../typechain-types";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("LaserHelper", () => {
    let helper: LaserHelper;

    beforeEach(async () => {
        await deployments.fixture();

        const _helper = await deployments.get("LaserHelper");
        helper = LaserHelper__factory.connect(_helper.address, ethers.provider);
    });

    describe("Single calls", () => {
        it("shoud return correct singleton", async () => {
            const { address, wallet } = await walletSetup();

            const payload = encodeFunctionData(abi, "singleton", []);

            const payloads = [payload];
            const to = [address];

            const result = await helper.getRequests(payloads, to);

            expect(`0x${result[0].slice(26).toLowerCase()}`).to.equal((await wallet.singleton()).toLowerCase());
        });

        it("should return correct owner", async () => {
            const { address, wallet } = await walletSetup();

            const payload = encodeFunctionData(abi, "owner", []);

            const payloads = [payload];
            const to = [address];

            const result = await helper.getRequests(payloads, to);

            expect(`0x${result[0].slice(26).toLowerCase()}`).to.equal((await wallet.owner()).toLowerCase());
        });

        it("should return correct locked state", async () => {
            const { address, wallet } = await walletSetup();

            const payload = encodeFunctionData(abi, "isLocked", []);

            const payloads = [payload];
            const to = [address];

            const result = await helper.getRequests(payloads, to);

            const isLocked = result[0].slice(result[0].length - 1) === "0" ? false : true;

            expect(isLocked).to.equal(await wallet.isLocked());
        });

        it("should return correct guardians", async () => {
            const { address, wallet } = await walletSetup();

            const _ssr = await deployments.get("LaserModuleSSR");
            const ssr = LaserModuleSSR__factory.connect(_ssr.address, ethers.provider);
            const payload = encodeFunctionData(LaserModuleSSR__factory.abi, "getGuardians", [address]);

            const payloads = [payload];
            const to = [ssr.address];

            const result = await helper.getRequests(payloads, to);

            const guardian1 = `0x${result[0].slice(154, 194)}`;
            const guardian2 = `0x${result[0].slice(218)}`;
            const guardians = [guardian1, guardian2];

            const walletGuardians = await ssr.getGuardians(address);

            for (let i = 0; i < walletGuardians.length; i++) {
                const guardian = walletGuardians[i].toLowerCase();
                expect(guardian).to.equal(guardians[i].toLowerCase());
            }
        });
    });

    describe("Batch calls", () => {
        it("should correctly execute batch calls", async () => {
            const { address, wallet } = await walletSetup();

            const payload1 = encodeFunctionData(abi, "singleton", []);
            const payload2 = encodeFunctionData(abi, "owner", []);
            const payload3 = encodeFunctionData(abi, "isLocked", []);

            const payloads = [payload1, payload2, payload3];
            const to = [address, address, address];

            const result = await helper.getRequests(payloads, to);

            const singleton = `0x${result[0].slice(26).toLowerCase()}`;
            expect((await wallet.singleton()).toLowerCase()).to.equal(singleton.toLowerCase());

            const owner = `0x${result[1].slice(26).toLowerCase()}`;
            expect((await wallet.owner()).toLowerCase()).to.equal(owner);

            const isLocked = result[2].slice(result[0].length - 1) === "0" ? false : true;
            expect(isLocked).to.equal(await wallet.isLocked());
        });
    });
});
