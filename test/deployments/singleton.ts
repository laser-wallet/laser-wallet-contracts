import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import { sign } from "../utils/sign";
import {
  encodeFunctionData,
  addressZero,
  specialOwner,
  walletSetup,
  paddedSignature
} from "../utils";

import { VERSION } from "../utils/constants";
const {
  abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Laser Wallet (singleton)", () => {
  let relayer: Signer;
  let singleton: Contract;
  let addr: string;

  beforeEach(async () => {
    [relayer] = await ethers.getSigners();
    const factorySingleton = await ethers.getContractFactory("LaserWallet");
    singleton = await factorySingleton.deploy();
    const factoryEntryPoint = await ethers.getContractFactory("TestEntryPoint");
    addr = (ethers.Wallet.createRandom()).address;
  });

  describe("singleton correct deployment", async () => {
    it("should have a threshold of 1 (so it becomes unusable)", async () => {
      const threshold = await singleton.getThreshold();
      expect(threshold).to.equal(1);
    });

    it("should not allow to setup", async () => {
      const randy = ethers.Wallet.createRandom();
      await expect(
        singleton.setup([randy.address], [], 1, addr, 0)
      ).to.be.revertedWith("'OM: Wallet already initialized'");
    });

    it("should not have owners", async () => {
      await expect(singleton.getOwners()).to.be.reverted;
    });

    it(`should be version ${VERSION}`, async () => {
      const version = await singleton.VERSION();
      expect(version).to.equal(VERSION);
    });

    it("should have a nonce of 0", async () => {
      const nonce = await singleton.nonce();
      expect(nonce).to.equal(0);
    });

    it("should not be able to make operations", async () => {
      await expect(singleton.changeThreshold(2)).to.be.revertedWith(
        "Only callable from the wallet"
      );
    });

    it("should not be able to execute a safe transaction", async () => {
      const data = encodeFunctionData(abi, "changeThreshold", [2]);
      const signature = paddedSignature(specialOwner.address);
      await expect(
        singleton.execTransaction(
          singleton.address,
          0,
          data,
          signature
        )
      ).to.be.reverted;
    });
  });
});
