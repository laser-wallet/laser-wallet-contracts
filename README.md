<p align="center">
  <img src="https://github.com/laser-wallet/laser-wallet-contracts/blob/master/docs/Logomark.png" width=280>
</p>

<br>

## Laser Wallet Contracts

This repository contains all the smart contracts from Laser. 

### Introduction

Laser is a security focused wallet for the Ethereum Virtual Machine. 

The contracts act as a safe multi-sig vault for a Laser wallet.


|Contract|Address|
|---|---|
|LaserWallet(singleton)|[0xc0c50cD7b8bD3dd34768418D6Debfb3Cd246E1fA]|
|LaserFactory|[0xFb41dbf20eC450C3a5fFE82ef410BaDe83790Cb1]|


Supported networks: 
- Mainnet
- Goerli 
- Ropsten






### Usage: 

Install the packages: 
```
npm i
```

Running the tests:
```
npm run test
```


Deploy: 

This command will deploy the contracts to the desired network, and verify them on Etherscan:
```
npm run deploy-and-verify <network-name>
```


### License

All the contracts are under the LGPL-3.0 License


### Open-source software


