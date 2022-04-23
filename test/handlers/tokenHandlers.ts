import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, providers, Signer, Wallet } from "ethers";

import { walletSetup } from "../utils";

const {
    abi
} = require("../../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

describe("Token Handlers", () => {
    let relayer: Signer;
    let TokenCaller: Contract;

    beforeEach(async () => {
        [relayer] = await ethers.getSigners();
        const tokenCallerFactory = await ethers.getContractFactory(
            "TokenCaller"
        );
        TokenCaller = await tokenCallerFactory.deploy();
    });

    describe("Handler Hooks", () => {
        it("should support ERC1155 interface", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const magicValue = "0x4e2312e0";
            const result = await TokenCaller.checkERC165(address, magicValue);
            expect(result).to.equal(true);
        });

        it("should handle onERC1155Received", async () => {
            const { address, wallet } = await walletSetup(relayer);
            //`bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))`
            const magicValue = "0xf23a6e61";
            const result = await TokenCaller.checkERC1155(address);
            expect(result).to.equal(magicValue);
        });

        it("should handle onERC1155BatchReceived", async () => {
            const { address, wallet } = await walletSetup(relayer);
            //`bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`
            const magicValue = "0xbc197c81";
            const result = await TokenCaller.checkERC115Batch(address);
            expect(result).to.equal(magicValue);
        });

        it("should handle onERC721Received", async () => {
            const { address, wallet } = await walletSetup(relayer);
            //bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))
            const magicValue = "0x150b7a02";
            const result = await TokenCaller.checkERC721(address);
            expect(result).to.equal(magicValue);
        });

        it("should support ERC721 interface", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const interfaceId = "0x150b7a02";
            const result = await TokenCaller.checkERC165(address, interfaceId);
            expect(result).to.equal(true);
        });

        it("should support ERC165", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const interfaceId = "0x01ffc9a7";
            const result = await TokenCaller.checkERC165(address, interfaceId);
            expect(result).to.equal(true);
        });

        it("should not support invalid interface", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const invalidValue = "0xffffffff";
            const result = await TokenCaller.checkERC165(address, invalidValue);
            expect(result).to.equal(false);
        });

        it("should support ERC165 for ERC1155", async () => {
            const { address, wallet } = await walletSetup(relayer);
            const interfaceId = "0xd9b67a26";
            expect(await wallet.supportsInterface(interfaceId)).to.equal(true);
        });
    });
});
