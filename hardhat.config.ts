import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/types";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-storage-layout";
import "hardhat-deploy";
import dotenv from "dotenv";
dotenv.config();

const INFURA_KEY = process.env.INFURA_KEY;
const ALCHEMY_URL = process.env.ALCHEMY_URL;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.15",
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
        optimism: {
            url: "https://mainnet.optimism.io",
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,

            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
        },
        "optimism-kovan": {
            url: "https://kovan.optimism.io",
            accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
        },
        hardhat: {
            forking: {
                enabled: process.env.FORKING === "true",
                url: `${ALCHEMY_URL}`,
            },
        },
    },

    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
    },
};

export default config;
