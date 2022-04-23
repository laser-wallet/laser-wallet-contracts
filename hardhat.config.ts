import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-solhint";
import "hardhat-gas-reporter";
import dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/types";

require("hardhat-storage-layout");

dotenv.config();
const INFURA_KEY = process.env.INFURA_KEY;
const ALCHEMY_URL = process.env.ALCHEMY_URL;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (DEPLOYER_PRIVATE_KEY?.length != 64) {
  console.error(
    `Incorrect Private Key!, length should be 64 but it is: ${DEPLOYER_PRIVATE_KEY?.length}`
  );
}

const mainnetUrl = `https://mainnet.infura.io/v3/${INFURA_KEY}`;
const goerliUrl = `https://goerli.infura.io/v3/${INFURA_KEY}`;
const rinkebyUrl = `https://rinkeby.infura.io/v3/${INFURA_KEY}`;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800
      },
      outputSelection: {
        "*": {
          "*": ["storageLayout"]
        }
      }
    }
  },
  networks: {
    mainnet: {
      url: mainnetUrl,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
    },
    goerli: {
      url: goerliUrl,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
    },
    optimism: {
      url: "https://mainnet.optimism.io",
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
    },
    hardhat: {
      forking: {
        enabled: process.env.FORKING === "true",
        url: `${ALCHEMY_URL}`
      }
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true"
  }
};

export default config;
