import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
  walletSetup,
  factorySetup,
  encodeFunctionData,
  sign,
  signTypedData,
  EIP712Sig,
} from "../utils";
import { userOp, types, Address } from "../types";
import { ownerWallet, tenEth, twoEth } from "../constants/constants";

const mock = ethers.Wallet.createRandom().address;
const {
  abi,
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Core", () => {
  let owner: Signer;
  let ownerAddress: Address;
  let guardians: Address[];
  let entryPoint: Address;
  let EntryPoint: Contract;
  let _guardian1: Signer;
  let _guardian2: Signer;
  let relayer: Signer;

  beforeEach(async () => {
    [owner, _guardian1, _guardian2, relayer] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    guardians = [await _guardian1.getAddress(), await _guardian2.getAddress()];
    const EP = await ethers.getContractFactory("TestEntryPoint");
    EntryPoint = await EP.deploy(mock, 0, 0);
    entryPoint = EntryPoint.address;
  });

  describe("init()", async () => {
    it("should not allow to call init after initialization", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      await expect(wallet.init(mock, guardians, entryPoint)).to.be.revertedWith(
        "Owner__WalletInitialized()"
      );
    });
  });
});
