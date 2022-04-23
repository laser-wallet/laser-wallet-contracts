import { expect } from "chai";
import { ethers } from "hardhat";
import { walletSetup } from "../utils";
import { utils } from "ethers";

describe("IsLaser", () => {
    it("should support Laser's magic value", async () => {
        // bytes4(keccak256("I_AM_LASER"))
        const hash = utils.keccak256(utils.toUtf8Bytes("I_AM_LASER"));
        const magicValue = hash.slice(0, 10);
        const [relayer] = await ethers.getSigners();
        const { address, wallet } = await walletSetup(relayer);

        expect(await wallet.supportsInterface(magicValue)).to.equal(true);
    });
});
