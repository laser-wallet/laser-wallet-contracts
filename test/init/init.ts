import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";
import {
  walletSetup,
  factorySetup,
  encodeFunctionData,
  initTests
} from "../utils";

const mock = ethers.Wallet.createRandom().address;
const {
  abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Setup", () => {
  let owner: Signer;
  let ownerAddress: string;
  let guardians: string[];
  let entryPoint: string;
  let _guardian1: Signer;
  let _guardian2: Signer;

  beforeEach(async () => {
    [owner, _guardian1, _guardian2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    guardians = [await _guardian1.getAddress(), await _guardian2.getAddress()];
    const EP = await ethers.getContractFactory("TestEntryPoint");
    const _entryPoint = await EP.deploy(mock, 0, 0);
    entryPoint = _entryPoint.address;
  });

  describe("Init", () => {
    it("should have correct test setup", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      await initTests(address);
    });
  });
});
