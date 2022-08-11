import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { LaserHelper } from "../../typechain-types/helper";
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

    describe("getWalletState()", () => {
        it("should return correct outputs", async () => {
            const { address, wallet } = await walletSetup();
            const Helper = await deployments.get("LaserHelper");
            const helper = await ethers.getContractAt(Helper.abi, Helper.address);

            const { owner, singleton, isLocked, guardians, recoveryOwners, nonce, balance } =
                await helper.getWalletState(address, SSRModule);
        });
    });

    describe("simulateTransaction()", () => {
        it("should simulate sending eth", async () => {
            // const { address, wallet } = await walletSetup();
            // const { ownerSigner } = await signersForTest();
            // await fundWallet(ownerSigner, address);
            // const to = ethers.Wallet.createRandom().address;
            // const value = ethers.utils.parseEther("100");
            // const callData = "0x";
            // const nonce = await wallet.nonce();
            // const maxFeePerGas = 0;
            // const maxPriorityFeePerGas = 0;
            // const gasLimit = 200000;
            // const relayer = await ownerSigner.getAddress();
            // const hash = await wallet.operationHash(
            //     to,
            //     value,
            //     callData,
            //     nonce,
            //     maxFeePerGas,
            //     maxPriorityFeePerGas,
            //     gasLimit
            // );
            // const signature = await sign(ownerSigner, hash);
            // const simWallet = new ethers.Contract(address, abi, ethers.provider);
            // const result = await simWallet.callStatic.simulateTransaction(
            //     to,
            //     value,
            //     callData,
            //     nonce,
            //     maxFeePerGas,
            //     maxPriorityFeePerGas,
            //     gasLimit,
            //     relayer,
            //     signature,
            //     { gasLimit: gasLimit, from: addrZero }
            // );
            // console.log("result -->", result.toString());
        });
    });
});
