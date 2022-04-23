import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import { sign } from "../utils/sign";
import {
  encodeFunctionData,
  addressZero,
  specialOwner,
  walletSetup, 
  changeThresholdData, 
  guardian
} from "../utils";

import { oneEth } from "../utils";

const {
  abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Receive", () => {
  let relayer: Signer;

  beforeEach(async () => {
    [relayer] = await ethers.getSigners();
  });

  describe("Correct setup", () => {
    it("Init", async () => {
      const { address, wallet } = await walletSetup(relayer);
      await guardian(address);
    });
  });

  describe("receive", () => {
    it("should be able to receive eth via send transaction", async () => {
      const { address, wallet } = await walletSetup(relayer);
      expect(
        await relayer.sendTransaction({
          to: wallet.address,
          value: oneEth
        })
      )
        .to.emit(wallet, "SafeReceived")
        .withArgs(await relayer.getAddress(), oneEth);
      const balance = await ethers.provider.getBalance(wallet.address);
      expect(balance).to.equal(oneEth);
    });

    it("should be able to receive eth via a contract call", async () => {
      const { address, wallet } = await walletSetup(relayer);
      let balance = await ethers.provider.getBalance(wallet.address);
      expect(balance).to.equal(0);
      const factoryCaller = await ethers.getContractFactory("Caller");
      const caller = await factoryCaller.deploy();
      const oneEth = ethers.utils.parseEther("10");
      // Funding the caller.
      await relayer.sendTransaction({
        to: caller.address,
        value: oneEth
      });
      // Executing the transaction from the caller.
      await caller._call(wallet.address, oneEth, "0x");
      balance = await ethers.provider.getBalance(wallet.address);
      expect(balance).to.equal(oneEth);
    });
  });

  describe("calldata calls", () => {
    it("should change the threshold through a contract call", async () => {
      const { address, wallet } = await walletSetup(relayer);
      const data = changeThresholdData(2);
      const hash = await wallet.getTransactionHash(
        wallet.address,
        0,
        data,
        0
      );
      const signature = await sign(specialOwner, hash);
      const calldata = encodeFunctionData(abi, "execTransaction", [
        wallet.address,
        0,
        data,
        signature
      ]);
      const factoryCaller = await ethers.getContractFactory("Caller");
      const caller = await factoryCaller.deploy();
      await caller._call(wallet.address, 0, calldata);
      const threshold = await wallet.getThreshold();
      expect(threshold).to.equal(2);
    });

    it("should change the threshold through a calldata call", async () => {
      const { address, wallet } = await walletSetup(relayer);
      const data = changeThresholdData(2);
      const hash = await wallet.getTransactionHash(
        wallet.address,
        0,
        data,
        0
      );
      const signature = await sign(specialOwner, hash);
      const calldata = encodeFunctionData(abi, "execTransaction", [
        wallet.address,
        0,
        data,
        signature
      ]);
      await relayer.sendTransaction({ to: wallet.address, data: calldata });
      const threshold = await wallet.getThreshold();
      expect(threshold).to.equal(2);
    });
  });
});
