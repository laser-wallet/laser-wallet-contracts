<p align="center">
  <img src="https://github.com/laser-wallet/laser-wallet-contracts/blob/logo2/docs/Logomark.png" width=280>
</p>

<br>

# Laser Wallet Contracts

## Laser is a modular non-custodial smart contract wallet made for the EVM.

### Laser has a plugin-based architecture which makes it extremely programmable by creating modules. 

#### It comes with a built-in recovery mechanism module called 'Smart Social Recovery', which was created by Laser.

#### The plugin-based model allows for all types of features, for example: 

##### - Recovery Mechanisms
##### - Multi-Sig
##### - Spending Limits
##### - Inheritance

#### etc... The limit is the creativity here.



## Usage: 

### 1. Install the packages: 
```
npm i
```

### 2. Create a .env file and add environment variables


### 3. Testing: 

#### This command will run all the tests:
```
npm run test
```

#### Apart from the conventional unit and integration tests, the contracts were also extensively tested with echidna, a propery-based smart contract fuzzer: https://github.com/crytic/echidna


### 4. Deploy: 

#### This command will deploy the contracts to the desired network, and verify them on Etherscan
```
npm run deploy-and-verify <network-name>
```


## License

### All the contracts are under the LGPL-3.0 License

### Acknowledgements

### The design of the contracts were greatly inspired by Gnosis Safe: https://github.com/safe-global/safe-contracts

## Open-source software


