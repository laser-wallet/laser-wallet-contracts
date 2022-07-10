import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import hre from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Address } from "../types";
import fs from "fs";

async function contractStorage(smartContractName: Address) {
    const { sourceName, contractName } = await hre.artifacts.readArtifact(smartContractName);

    const stateVariables = [];

    for (const artifactPath of await hre.artifacts.getBuildInfoPaths()) {
        const artifact = fs.readFileSync(artifactPath);
        const artifactJsonABI = JSON.parse(artifact.toString());

        const artifactIncludesStorageLayout =
            artifactJsonABI?.output?.contracts?.[sourceName]?.[contractName]?.storageLayout;
        if (!artifactIncludesStorageLayout) {
            continue;
        }

        const contractStateVariablesFromArtifact =
            artifactJsonABI.output.contracts[sourceName][contractName].storageLayout.storage;
        for (const stateVariable of contractStateVariablesFromArtifact) {
            stateVariables.push({
                name: stateVariable.label,
                slot: stateVariable.slot,
                offset: stateVariable.offset,
                type: stateVariable.type,
            });
        }
        break;
    }

    return stateVariables;
}

describe("Contract Storage", () => {
    beforeEach(async () => {
        await deployments.fixture();
    });

    it("Laser should have the same storage as LaserWalletStorage", async () => {
        const laserWallet = await contractStorage("LaserWallet");
        const laserWalletStorage = await contractStorage("LaserWalletStorage");

        expect(JSON.stringify(laserWallet)).to.equal(JSON.stringify(laserWalletStorage));
    });
});
