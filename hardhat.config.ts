import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-solhint";

require("hardhat-storage-layout");
require("dotenv").config();

const GOERLI_URL = process.env.GOERLI_URL;
const RINKEBY_URL = process.env.RINKEBY_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_URL = process.env.ALCHEMY_URL;
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

if (PRIVATE_KEY?.length != 64) {
  console.error(`Incorrect Private Key!, length should be 64 but it is: ${PRIVATE_KEY?.length}`);
}


module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800
      },
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  networks: {
    goerli: {
      url: GOERLI_URL,
      accounts: [`0x${PRIVATE_KEY}`]
    }
    }, 
    etherscan: {
      apiKey: ALCHEMY_KEY,
      // hardhat: {
      //   forking: {
      //     url: ALCHEMY_URL
      //   }
      // }
    },
    mocha: {
      timeout: 80000
  }
};
