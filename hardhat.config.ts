import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-solhint";
import { HardhatUserConfig } from "hardhat/types";
import "hardhat-gas-reporter";
import "hardhat-storage-layout";
import "hardhat-deploy";
import dotenv from "dotenv";


dotenv.config();
const INFURA_KEY = process.env.INFURA_KEY;
const ALCHEMY_URL = process.env.ALCHEMY_URL;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;


const MAINNET_URL = `https://mainnet.infura.io/v3/${INFURA_KEY}`;
const GOERLI_URL = `https://goerli.infura.io/v3/${INFURA_KEY}`;
const RINKEBY_URL = `https://rinkeby.infura.io/v3/${INFURA_KEY}`;


const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800
      },
      evmVersion: "london",
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  networks: {
    mainnet: {
      url: MAINNET_URL,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
    },
    goerli: {
      url: GOERLI_URL,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`]
    }, 
    optimism: {
      url: "https://mainnet.optimism.io", 
      accounts : [`0x${DEPLOYER_PRIVATE_KEY}`]
    },
    "optimism-kovan": {
      url: "https://kovan.optimism.io", 
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




