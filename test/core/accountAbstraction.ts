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

// Sends 10 eth...
async function fund(to: Address, from: Signer): Promise<void> {
  const amount = tenEth;
  await from.sendTransaction({ to: to, value: amount });
}

describe("Account Abstraction", () => {
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
    const _EntryPoint = await ethers.getContractFactory("TestEntryPoint");
    EntryPoint = await _EntryPoint.deploy(mock, 0, 0);
    entryPoint = EntryPoint.address;
  });

  describe("validateUserOp() 'handleOp'", () => {
    it("should only accept calls from the entry point", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      const fkBytes =
        "0xb00e65f7e6801b0a78eb54b58b48a2b831b8e25c08de88918ac71d5214e9c4ee";
      userOp.sender = wallet.address;
      userOp.nonce = 0;
      userOp.callData = "0x";
      userOp.signature = "0x";
      await expect(
        wallet.validateUserOp(userOp, fkBytes, 0)
      ).to.be.revertedWith("LW_NotEntryPoint()");
    });

    it("should revert by calling a function directly from EntryPoint", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      const data = encodeFunctionData(abi, "changeOwner", [mock]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = data;
      userOp.signature = "0x";
      const hash = await wallet.userOperationHash(userOp);
      userOp.signature = await sign(owner, hash);
      await expect(EntryPoint.handleOps([userOp], mock)).to.be.reverted;
    });
  });

  describe("Correct data", () => {
    it("should have correct domain separator", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      const domainSeparator = ethers.utils._TypedDataEncoder.hashDomain({
        verifyingContract: address,
        chainId: await wallet.getChainId(),
      });
      expect(domainSeparator).to.equal(await wallet.domainSeparator());
    });

    it("should calculate correctly the transaction hash", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = "0x";
      const transactionHash = ethers.utils._TypedDataEncoder.hash(
        {
          verifyingContract: address,
          chainId: await wallet.getChainId(),
        },
        types,
        userOp
      );
      const _transactionHash = await wallet.userOperationHash(userOp);
      expect(transactionHash).to.equal(_transactionHash);
    });
  });

  describe("Transactions", () => {
    it("should execute an EIP712 transaction", async () => { 
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      await fund(address, relayer);

      const domain = {
        chainId: await wallet.getChainId(),
        verifyingContract: address,
      };
      const txData = encodeFunctionData(abi, "changeOwner", [mock]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);

      const txMessage = {
        sender: userOp.sender,
        nonce: userOp.nonce,
        callData: userOp.callData,
        callGas: userOp.callGas,
        verificationGas: userOp.verificationGas,
        preVerificationGas: userOp.preVerificationGas,
        maxFeePerGas: userOp.maxFeePerGas,
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
        paymaster: userOp.paymaster,
        paymasterData: userOp.paymasterData,
      };
      userOp.signature = await EIP712Sig(ownerWallet, domain, txMessage);
      await EntryPoint.handleOps([userOp], address);
      expect(await wallet.owner()).to.equal(mock);
    });

    it("should execute a transaction by signing the transaction hash", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);

      const txData = encodeFunctionData(abi, "changeOwner", [mock]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);
      const hash = await wallet.userOperationHash(userOp);
      userOp.signature = await sign(owner, hash);
      await EntryPoint.handleOps([userOp], address);
      expect(await wallet.owner()).to.equal(mock);
    });

    it("should fail by signing an incorrect hash", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);

      const txData = encodeFunctionData(abi, "changeOwner", [mock]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);

      const fkHash =
        "0xb00e65f7e6801b0a78eb54b58b48a2b831b8e25c08de88918ac71d5214e9c4ee";
      userOp.signature = await sign(owner, fkHash);
      await expect(EntryPoint.handleOps([userOp], address)).to.be.reverted;
    });

    it("should fail by providing incorrect calldata", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);

      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = "0x12345678";
      const hash = await wallet.userOperationHash(userOp);
      userOp.signature = await sign(owner, hash);
      await expect(EntryPoint.handleOps([userOp], address)).to.be.reverted;
    });

    it("should execute a multicall", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);
      const initialBal = await ethers.provider.getBalance(address);
      expect(initialBal).to.equal(tenEth);

      const tx1 = {
        to: address,
        value: 0,
        data: encodeFunctionData(abi, "changeOwner", [mock]),
      };
      const tx2 = {
        to: mock,
        value: twoEth,
        data: "0x",
      };
      const transactions = [tx1, tx2];
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "multiCall", [transactions]);
      const hash = await wallet.userOperationHash(userOp);
      userOp.signature = await sign(owner, hash);
      await EntryPoint.handleOps([userOp], address);

      const postBal = await ethers.provider.getBalance(address);
      expect(postBal).to.not.equal(tenEth);
      expect(await wallet.owner()).to.equal(mock);
    });

    it("should revert by providing an invalid nonce", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);

      const txData = encodeFunctionData(abi, "changeOwner", [mock]);
      userOp.sender = address;
      userOp.nonce = 1;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);

      const hash = await wallet.userOperationHash(userOp);
      userOp.signature = await sign(owner, hash);
      await expect(EntryPoint.handleOps([userOp], address)).to.be.reverted;
    });

    it("should revert if the owner calls 'guardianCall' ", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);

      const txData = encodeFunctionData(abi, "changeOwner", [mock]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "guardianCall", ["0x"]);

      const hash = await wallet.userOperationHash(userOp);
      userOp.signature = await sign(owner, hash);
      await expect(EntryPoint.handleOps([userOp], address)).to.be.reverted;
    });

    it("should remove a guardian", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      await fund(address, relayer);
      let _guardians = await wallet.getGuardians();
      const guardianToRemove = _guardians[1];
      expect(await wallet.isGuardian(guardianToRemove)).to.equal(true);
      const txData = encodeFunctionData(abi, "removeGuardian", [
        _guardians[0],
        guardianToRemove,
      ]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);

      const hash = await wallet.userOperationHash(userOp);
      userOp.signature = await sign(owner, hash);
      await EntryPoint.handleOps([userOp], address);

      _guardians = await wallet.getGuardians();
      expect(await wallet.isGuardian(guardianToRemove)).to.equal(false);
    });
  });

  describe("Change Entry Point", () => {
    it("should revert by calling the function directly", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );
      const randy = ethers.Wallet.createRandom();
      await expect(wallet.changeEntryPoint(randy.address)).to.be.revertedWith(
        "SelfAuthorized__OnlyCallableFromWallet()"
      );
    });

    it("should fail by changing the entry point to 'this' ", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);

      const txData = encodeFunctionData(abi, "changeEntryPoint", [address]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);
      await expect(wallet.exec(address, 0, txData)).to.be.reverted;
    });

    it("should fail by changing the entry point to a non-contract ", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);

      const txData = encodeFunctionData(abi, "changeEntryPoint", [mock]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);
      await expect(wallet.exec(address, 0, txData)).to.be.reverted;
    });

    it("should fail by changing the entry point address to current", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);

      const txData = encodeFunctionData(abi, "changeEntryPoint", [
        EntryPoint.address,
      ]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);
      await expect(wallet.exec(address, 0, txData)).to.be.reverted;
    });

    it("should update the entry point from 'exec' ", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);
      const _newEntryPoint = await ethers.getContractFactory(
        "AccountAbstraction"
      );
      const newEntryPoint = await _newEntryPoint.deploy();
      const addr = newEntryPoint.address;
      const txData = encodeFunctionData(abi, "changeEntryPoint", [addr]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);
      await expect(wallet.exec(address, 0, txData))
        .to.emit(wallet, "EntryPointChanged")
        .withArgs(addr);
      expect(await wallet.entryPoint()).to.equal(addr);
    });

    it("should change entry point from 'handleOps' ", async () => {
      const { address, wallet } = await walletSetup(
        ownerAddress,
        guardians,
        entryPoint
      );

      await fund(address, relayer);
      const _newEntryPoint = await ethers.getContractFactory(
        "AccountAbstraction"
      );
      const newEntryPoint = await _newEntryPoint.deploy();
      const addr = newEntryPoint.address;
      const txData = encodeFunctionData(abi, "changeEntryPoint", [addr]);
      userOp.sender = address;
      userOp.nonce = 0;
      userOp.callData = encodeFunctionData(abi, "exec", [address, 0, txData]);

      const hash = await wallet.userOperationHash(userOp);
      userOp.signature = await sign(owner, hash);
      await EntryPoint.handleOps([userOp], address);
      expect(await wallet.entryPoint()).to.equal(addr);
    });
  });
});
