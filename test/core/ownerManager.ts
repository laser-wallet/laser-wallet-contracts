import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, Wallet } from "ethers";

import {
  encodeFunctionData,
  addressZero,
  SENTINEL,
  specialOwner,
  owner1,
  owner2,
  owner3,
  walletSetup,
  safeTx,
  execTx, 
  guardian
} from "../utils";
import { SafeTx } from "../types";
import  {internalSignature} from "../utils/sign";

const {
  abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("OwnerManager", () => {
  let relayer: Signer;
  let internalTx: SafeTx;
  let randy: Signer;
  let randyAddress: string;

  beforeEach(async () => {
    [relayer] = await ethers.getSigners();
    internalTx = safeTx;
    randy = ethers.Wallet.createRandom();
    randyAddress = await randy.getAddress();
  });

  describe("Correct setup", async () => {
    it("Init", async () => {
      const { address, wallet } = await walletSetup(relayer);
      await guardian(address);
    });
  });

  describe("addOwnerWithThreshold()", () => {
    it("should revert by calling the function directly", async () => {
      const { address, wallet } = await walletSetup(relayer);
      await expect(
        wallet.addOwnerWithThreshold(addressZero, 2)
      ).to.be.revertedWith("SA: Only callable from the wallet");
    });

    it("should not accept the safe as owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addOwnerWithThreshold", [
        wallet.address,
        2
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not accept the sentinel as owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addOwnerWithThreshold", [
        SENTINEL,
        2
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not accept the address 0 as owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addOwnerWithThreshold", [
        addressZero,
        2
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not be able to add the same owner twice", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addOwnerWithThreshold", [
        specialOwner.address,
        2
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not be able to add an owner and change the threshold to 0", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addOwnerWithThreshold", [
        randyAddress,
        0
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not be able to add an owner and set a threshold larger than the owner count", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addOwnerWithThreshold", [
        randyAddress,
        10
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should emit event when adding a new owner and changing the threshold", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addOwnerWithThreshold", [
        randyAddress,
        2
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(
        wallet.execTransaction(
          internalTx.to,
          internalTx.value,
          internalTx.data,

          internalTx.signature
        )
      )
        .to.emit(wallet, "AddedOwner")
        .withArgs(randyAddress);
    });
  });

  describe("removeOwner", () => {
    it("should revert by calling the function directly", async () => {
      const { address, wallet } = await walletSetup(relayer);
      await expect(
        wallet.removeOwner(SENTINEL, SENTINEL, 2)
      ).to.be.revertedWith("Only callable from the wallet");
    });

    it("should not be able to remove the sentinel", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeOwner", [
        owner3.address,
        SENTINEL,
        3
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should revert by providing invalid prev owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeOwner", [
        owner3.address,
        owner1.address,
        2
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not be able to remove an owner and change the threshold to 0", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeOwner", [
        owner2.address,
        owner3.address,
        0
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should emit correct events", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeOwner", [
        owner2.address,
        owner3.address,
        2
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(
        wallet.execTransaction(
          internalTx.to,
          internalTx.value,
          internalTx.data,

          internalTx.signature
        )
      )
        .to.emit(wallet, "RemovedOwner")
        .withArgs(owner3.address)
        .and.to.emit(wallet, "ChangedThreshold")
        .withArgs(2);
    });

    it("should remove the special owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(true);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeOwner", [
        SENTINEL,
        specialOwner.address,
        2
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await execTx(wallet, internalTx);
      expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(false);
    });
  });

  describe("changeThreshold()", () => {
    it("should revert by calling the function directly", async () => {
      const { address, wallet } = await walletSetup(relayer);
      await expect(wallet.changeThreshold(2)).to.be.revertedWith(
        "Only callable from the wallet"
      );
    });

    it("should revert by setting a higher threshold than the owner count", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "changeThreshold", [5]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should revert by setting the threshold to 0", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "changeThreshold", [0]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should change the threshold and emit event", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "changeThreshold", [2]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(
        wallet.execTransaction(
          internalTx.to,
          internalTx.value,
          internalTx.data,

          internalTx.signature
        )
      )
        .to.emit(wallet, "ChangedThreshold")
        .withArgs(2);
    });
  });

  describe("addSpecialOwner()", async () => {
    it("should revert by calling the function directly", async () => {
      const { address, wallet } = await walletSetup(relayer);
      await expect(wallet.addSpecialOwner(randyAddress)).to.be.revertedWith(
        "Only callable from the wallet"
      );
    });

    it("should not accept the safe itself", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addSpecialOwner", [
        wallet.address
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not accept address 0", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addSpecialOwner", [
        addressZero
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not accept a duplicate special owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addSpecialOwner", [
        specialOwner.address
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should add a current owner as a special owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addSpecialOwner", [
        owner2.address
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      expect(await wallet.isSpecialOwner(owner2.address)).to.equal(false);
      await execTx(wallet, internalTx);
      expect(await wallet.isSpecialOwner(owner2.address)).to.equal(true);
    });

    it("should add a random address as a special owner (and as a consequence, as an owner)", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addSpecialOwner", [
        randyAddress
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      expect(await wallet.isSpecialOwner(randyAddress)).to.equal(false);
      expect(await wallet.isOwner(randyAddress)).to.equal(false);
      await execTx(wallet, internalTx);
      expect(await wallet.isSpecialOwner(randyAddress)).to.equal(true);
      expect(await wallet.isOwner(randyAddress)).to.equal(true);
    });

    it("should add an owner and emit event", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "addSpecialOwner", [
        randyAddress
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(
        wallet.execTransaction(
          internalTx.to,
          internalTx.value,
          internalTx.data,

          internalTx.signature
        )
      )
        .to.emit(wallet, "AddedSpecialOwner")
        .withArgs(randyAddress);
    });
  });

  describe("removeSpecialOwner()", () => {
    it("should revert by calling the function directly", async () => {
      const { address, wallet } = await walletSetup(relayer);
      await expect(
        wallet.removeSpecialOwner(specialOwner.address)
      ).to.be.revertedWith("Only callable from the wallet");
    });

    it("should not accept an address that is not special owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeSpecialOwner", [
        randyAddress
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should not accept an owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeSpecialOwner", [
        owner2.address
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(execTx(wallet, internalTx)).to.be.revertedWith(
        "Execution error"
      );
    });

    it("should remove a special owner but remains as an owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeSpecialOwner", [
        specialOwner.address
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(true);
      expect(await wallet.isOwner(specialOwner.address)).to.equal(true);
      await execTx(wallet, internalTx);
      expect(await wallet.isSpecialOwner(specialOwner.address)).to.equal(false);
      expect(await wallet.isOwner(specialOwner.address)).to.equal(true);
    });

    it("should emit proper event", async () => {
      const { address, wallet } = await walletSetup(relayer);
      internalTx.to = wallet.address;
      internalTx.data = encodeFunctionData(abi, "removeSpecialOwner", [
        specialOwner.address
      ]);
      internalTx.signature = await internalSignature(specialOwner, internalTx, wallet);
      await expect(
        wallet.execTransaction(
          internalTx.to,
          internalTx.value,
          internalTx.data,

          internalTx.signature
        )
      )
        .to.emit(wallet, "RemovedSpecialOwner")
        .withArgs(specialOwner.address);
    });
  });

  describe("getSpecialOwners()", () => {
    it("should output the current special owner", async () => {
      const { address, wallet } = await walletSetup(relayer);
      const specialOwners = await wallet.getSpecialOwners();
      expect(specialOwners.length).to.equal(1);
      expect(specialOwners[0]).to.equal(specialOwner.address);
    });

    it("should revert if there are no special owners", async () => {
      const { address, wallet } = await walletSetup(
        relayer,
        [owner1.address],
        [],
        1
      );
      await expect(wallet.getSpecialOwners()).to.be.revertedWith(
        "'OM: There are no special owners'"
      );
    });
  });
});
