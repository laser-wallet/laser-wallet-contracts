import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, providers, Signer, Wallet } from "ethers";
import { walletSetup } from "../utils";
import { Address } from "../types";

const mock = Wallet.createRandom().address;
const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Handlers", () => {
    let owner: Signer;
    let ownerAddress: Address;
    let recoveryOwner1: Signer;
    let recoveryOwner2: Signer;
    let guardians: Address[];
    let _guardian1: Signer;
    let _guardian2: Signer;
    let relayer: Signer;
    let recoveryOwners: Address[];
    let TokenCaller: Contract;

    beforeEach(async () => {
        [
            owner,
            recoveryOwner1,
            recoveryOwner2,
            _guardian1,
            _guardian2,
            relayer
        ] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
        recoveryOwners = [
            await recoveryOwner1.getAddress(),
            await recoveryOwner2.getAddress()
        ];
        guardians = [
            await _guardian1.getAddress(),
            await _guardian2.getAddress()
        ];

        const tokenCallerFactory = await ethers.getContractFactory(
            "TokenCaller"
        );
        TokenCaller = await tokenCallerFactory.deploy();
    });

    describe("Token Handlers", () => {
        it("should support ERC1155 interface", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const magicValue = "0x4e2312e0";
            const result = await TokenCaller.checkERC165(address, magicValue);
            expect(result).to.equal(true);
        });

        it("should handle onERC1155Received", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            //`bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))`
            const magicValue = "0xf23a6e61";
            const result = await TokenCaller.checkERC1155(address);
            expect(result).to.equal(magicValue);
        });

        it("should handle onERC1155BatchReceived", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            //`bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`
            const magicValue = "0xbc197c81";
            const result = await TokenCaller.checkERC115Batch(address);
            expect(result).to.equal(magicValue);
        });

        it("should handle onERC721Received", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            //bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))
            const magicValue = "0x150b7a02";
            const result = await TokenCaller.checkERC721(address);
            expect(result).to.equal(magicValue);
        });

        it("should support ERC721 interface", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const interfaceId = "0x150b7a02";
            const result = await TokenCaller.checkERC165(address, interfaceId);
            expect(result).to.equal(true);
        });

        it("should support ERC165", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const interfaceId = "0x01ffc9a7";
            const result = await TokenCaller.checkERC165(address, interfaceId);
            expect(result).to.equal(true);
        });

        it("should not support invalid interface", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const invalidValue = "0xffffffff";
            const result = await TokenCaller.checkERC165(address, invalidValue);
            expect(result).to.equal(false);
        });

        it("should support ERC165 for ERC1155", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            const interfaceId = "0xd9b67a26";
            expect(await wallet.supportsInterface(interfaceId)).to.equal(true);
        });
    });

    describe("Laser's magic value", () => {
        it("should support Laser's magic value", async () => {
            const { address, wallet } = await walletSetup(
                ownerAddress,
                recoveryOwners,
                guardians
            );
            // bytes4(keccak256("I_AM_LASER"))
            const hash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes("I_AM_LASER")
            );
            const magicValue = hash.slice(0, 10);
            const [relayer] = await ethers.getSigners();
            expect(await wallet.supportsInterface(magicValue)).to.equal(true);
        });
    });
});
