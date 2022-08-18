import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";

import { HardhatUserConfig } from "hardhat/types";

import "hardhat-gas-reporter";
import "hardhat-storage-layout";
import "hardhat-deploy";
import "solidity-coverage";

import "./tasks/deploy_and_verify";

import dotenv from "dotenv";

dotenv.config();

let { INFURA_KEY, ALCHEMY_URL, DEPLOYER_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

if (DEPLOYER_PRIVATE_KEY === undefined) {
    DEPLOYER_PRIVATE_KEY = "3e13b1b48cb1afe4fe0decd5a4fe3b44a15273b2100a861b33e616f0c16526e4";
}

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.16",
        settings: {
            optimizer: {
                enabled: true,
                runs: 800,
            },
            outputSelection: {
                "*": {
                    "*": ["storageLayout"],
                },
            },
        },
    },
    networks: {
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
        },
        goerli: {
            url: `https://goerli.infura.io/v3/${INFURA_KEY}`,
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
        },
        kovan: {
            url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
        },
        ropsten: {
            url: `https://ropsten.infura.io/v3/${INFURA_KEY}`,
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
        },
        hardhat: {
            forking: {
                enabled: process.env.FORKING === "true",
                url: `${ALCHEMY_URL}`,
            },
        },
    },
    namedAccounts: {
        deployer: 0,
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
    },
};

export default config;
