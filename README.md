# Laser Wallet Contracts

## Laser is a non-custodial smart contract wallet made for the EVM.

### It implements the following features:

#### 1. Smart Social Recovery: A new recovery mechanism that evolves from the traditional social recovery. It provides the same benefits --> abstracts away the seed phrase and implements guardians in case that the main device is lost. The main difference is that this mechanism is more bullet-proof in the sense that the guardians can never freeze or take the users funds.

#### 2. It is primarily made so the transactions are sent through a relayer, so it abstracts away the need to pay gas through an EOA.



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
npm run deploy-and-verify --network <network-name>
```


### The contracts are deployed deterministically, any minor change will output a different address

## License

### All the contracts are under the LGPL-3.0 License

### Acknowledgements

### The design of the contracts were greatly inspired by Gnosis Safe: https://github.com/safe-global/safe-contracts

## Open-source software


