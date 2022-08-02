import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { laserHelperSol } from "../../typechain-types/helper";
import { addrZero } from "../constants/constants";
import { Address } from "../types";
import { addressesForTest, encodeFunctionData, fundWallet, getHash, sign, signersForTest, walletSetup } from "../utils";

const { abi } = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

const random = ethers.Wallet.createRandom().address;
describe("LaserHelper", () => {
    let SSRModule: Address;

    beforeEach(async () => {
        await deployments.fixture();

        SSRModule = (await deployments.get("LaserModuleSSR")).address;
    });

    // describe("getWalletState()", () => {
    //     it("should return correct outputs", async () => {
    //         const { address, wallet } = await walletSetup();
    //         const { recoveryOwners, guardians } = await addressesForTest();
    //         const Helper = await deployments.get("LaserHelper");
    //         const helper = await ethers.getContractAt(Helper.abi, Helper.address);

    //         const results = await helper.getWalletState(address, SSRModule);

    //         expect(results.owner).to.equal(await wallet.owner());
    //         expect(results.singleton).to.equal(await wallet.singleton());
    //         expect(results.isLocked).to.equal(false);
    //         expect(results.isLocked).to.equal(await wallet.isLocked());
    //         expect(results.balance).to.equal(0);
    //         expect(results.timeLock).to.equal(0);
    //         expect(JSON.stringify(recoveryOwners)).to.equal(JSON.stringify(results.recoveryOwners));
    //         expect(JSON.stringify(guardians)).to.equal(JSON.stringify(results.guardians));
    //     });
    // });

    describe("simulateTransaction()", () => {
        it("should simulate sending eth", async () => {
            const { address, wallet } = await walletSetup();

            const { ownerSigner } = await signersForTest();

            await fundWallet(ownerSigner, address);

            const to = ethers.Wallet.createRandom().address;
            const value = ethers.utils.parseEther("100");
            const callData = "0x";
            const nonce = await wallet.nonce();
            const maxFeePerGas = 0;
            const maxPriorityFeePerGas = 0;
            const gasLimit = 200000;
            const relayer = await ownerSigner.getAddress();

            const hash = await wallet.operationHash(
                to,
                value,
                callData,
                nonce,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasLimit
            );

            const signature = await sign(ownerSigner, hash);

            const simWallet = new ethers.Contract(address, abi, ethers.provider);
            const result = await simWallet.callStatic.simulateTransaction(
                to,
                value,
                callData,
                nonce,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasLimit,
                relayer,
                signature,
                { gasLimit: gasLimit, from: addrZero }
            );

            console.log("result -->", result.toString());
        });
    });
});
