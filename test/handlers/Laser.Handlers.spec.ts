import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract } from "ethers";
import { walletSetup, AddressesForTest } from "../utils";

describe("Handlers", () => {
    let addresses: AddressesForTest;
    let tokenCaller: Contract;

    beforeEach(async () => {
        await deployments.fixture();
        const tokenCallerFactory = await ethers.getContractFactory("TokenCaller");
        tokenCaller = await tokenCallerFactory.deploy();
    });

    describe("Token Handlers", () => {
        it("should support ERC1155 interface", async () => {
            const { address, wallet } = await walletSetup();
            const magicValue = "0x4e2312e0";
            const result = await tokenCaller.checkERC165(address, magicValue);
            expect(result).to.equal(true);
        });

        it("should handle onERC1155Received", async () => {
            const { address, wallet } = await walletSetup();
            //`bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))`
            const magicValue = "0xf23a6e61";
            const result = await tokenCaller.checkERC1155(address);
            expect(result).to.equal(magicValue);
        });

        it("should handle onERC1155BatchReceived", async () => {
            const { address, wallet } = await walletSetup();
            //`bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`
            const magicValue = "0xbc197c81";
            const result = await tokenCaller.checkERC115Batch(address);
            expect(result).to.equal(magicValue);
        });

        it("should handle onERC721Received", async () => {
            const { address, wallet } = await walletSetup();
            //bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))
            const magicValue = "0x150b7a02";
            const result = await tokenCaller.checkERC721(address);
            expect(result).to.equal(magicValue);
        });

        it("should support ERC721 interface", async () => {
            const { address, wallet } = await walletSetup();
            const interfaceId = "0x150b7a02";
            const result = await tokenCaller.checkERC165(address, interfaceId);
            expect(result).to.equal(true);
        });

        it("should support ERC165", async () => {
            const { address, wallet } = await walletSetup();
            const interfaceId = "0x01ffc9a7";
            const result = await tokenCaller.checkERC165(address, interfaceId);
            expect(result).to.equal(true);
        });

        it("should not support invalid interface", async () => {
            const { address, wallet } = await walletSetup();
            const invalidValue = "0xffffffff";
            const result = await tokenCaller.checkERC165(address, invalidValue);
            expect(result).to.equal(false);
        });

        it("should support ERC165 for ERC1155", async () => {
            const { address, wallet } = await walletSetup();
            const interfaceId = "0xd9b67a26";
            expect(await wallet.supportsInterface(interfaceId)).to.equal(true);
        });
    });

    describe("Laser's magic value", () => {
        it("should support Laser's magic value", async () => {
            const { address, wallet } = await walletSetup();
            // bytes4(keccak256("I_AM_LASER"))
            const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("I_AM_LASER"));
            const magicValue = hash.slice(0, 10);
            const [relayer] = await ethers.getSigners();
            expect(await wallet.supportsInterface(magicValue)).to.equal(true);
        });
    });
});
