import { ethers, utils, providers, Wallet, Contract, BigNumber } from "ethers";
import { Provider } from "@ethersproject/providers";

import axios from "axios";
import { exec } from "child_process";

import { UserOp } from "../test/types";
import { walletSetup } from "../test/utils";

require("dotenv").config();

const {
    abi,
    bytecode
} = require("../artifacts/contracts/LaserWallet.sol/LaserWallet.json");

// Runs an account abstraction op.
class LaserRun {
    provider: Provider;
    signer: Wallet;
    aaUrl: string;
    proxy: Contract;

    /**
     *
     * @param proxyAddress Proxy address that delegates calls to the singleton 'LaserWallet.sol'.
     */
    constructor(proxyAddress: string) {
        this.provider = new providers.JsonRpcProvider(
            `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`
        );
        this.signer = new Wallet(
            `${process.env.DEPLOYER_PRIVATE_KEY}`,
            this.provider
        );
        this.aaUrl = `${process.env.AA_URL}`;
        this.proxy = new ethers.Contract(proxyAddress, abi, this.signer);
    }

    signerAddress(): string {
        return this.signer.address;
    }

    async getHash(userOp: UserOp): Promise<string> {
        return await this.proxy.userOperationHash(userOp);
    }

    async signHash(hash: string): Promise<string> {
        const typedDataHash = ethers.utils.arrayify(hash);
        return (await this.signer.signMessage(typedDataHash))
            .replace(/1b$/, "1f")
            .replace(/1c$/, "20");
    }

    async entryPoint(): Promise<string> {
        return await this.proxy.entryPoint();
    }

    async walletBalance(): Promise<number | BigNumber> {
        return await this.provider.getBalance(this.proxy.address);
    }

    async owners(): Promise<string[]> {
        return await this.proxy.getOwners();
    }

    async nonce(): Promise<number | string> {
        return await this.proxy.nonce();
    }

    async bal(addr: string): Promise<string | BigNumber | number> {
        return await this.provider.getBalance(addr);
    }

    encodeFunctionData(functionName: string, ..._params: any[]): string {
        const params = _params[0];
        const iface = new ethers.utils.Interface(abi);
        const data = iface.encodeFunctionData(functionName, params);
        return data;
    }

    encodeCallData(
        to: string,
        value: number | string | BigNumber,
        data: string
    ): string {
        const _data = this.encodeFunctionData("execFromEntryPoint", [
            to,
            value,
            data
        ]);
        return _data;
    }

    async userOp(_callData: string, _signature?: string): Promise<UserOp> {
        return {
            sender: this.proxy.address,
            nonce: await this.nonce(),
            initCode: "0x",
            callData: _callData,
            callGas: 200000,
            verificationGas: 100000,
            preVerificationGas: 100000,
            maxFeePerGas: 1100000000,
            maxPriorityFeePerGas: 1100000000,
            paymaster: ethers.constants.AddressZero,
            paymasterData: "0x",
            signature: _signature ? _signature : "0x"
        };
    }

    async sendUserOp(_callData: string, _signature: string) {
        const _userOp = await this.userOp(_callData, _signature);

        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_sendUserOperation",
            params: [
                {
                    sender: _userOp.sender,
                    nonce: _userOp.nonce.toString(),
                    initCode: _userOp.initCode,
                    callData: _callData,
                    callGas: _userOp.callGas, // amount of gas for main execution call.
                    verificationGas: _userOp.verificationGas, // Amount of gas to allocate for the verification loop.
                    preVerificationGas: _userOp.preVerificationGas,
                    maxFeePerGas: _userOp.maxFeePerGas,
                    maxPriorityFeePerGas: _userOp.maxPriorityFeePerGas,
                    paymaster: _userOp.paymaster,
                    paymasterData: _userOp.paymasterData,
                    signature: _signature
                },
                await this.entryPoint()
            ]
        };
        try {
            const response = await axios.post(this.aaUrl, request);
            console.log(response);
        } catch (e) {
            throw e;
        }
    }

    async fundWallet(amount: BigNumber) {
        return await this.signer.sendTransaction({
            to: this.proxy.address,
            value: amount
        });
    }
}

async function run(_proxyAddress: string) {
    const receiver = ethers.Wallet.createRandom();
    const proxyAddress = _proxyAddress;
    const laser = new LaserRun(proxyAddress);
    console.log(" F U N D I N G  T H E  W A L L E T");
    console.log(" . . - - - . . . - - - - . . . . - -- . . ");
    await laser.fundWallet(utils.parseEther("0.1"));
    await new Promise(f => setTimeout(f, 20000));
    const _initialBalance = await laser.bal(proxyAddress);
    const initialBalance = utils.formatEther(_initialBalance);
    console.log("pre transaction wallet balance:", initialBalance);
    console.log("receiver balance:", utils.formatEther(await laser.bal(receiver.address)));

    ///// tx info /////
    const to = proxyAddress;
    const value = utils.parseEther("0.05");
    const data = "0x";
    const callData = laser.encodeCallData(to, value, data);
    const _userOp = await laser.userOp(callData);
    const hash = await laser.getHash(_userOp);
    const signature = await laser.signHash(hash);
    const userOp = await laser.userOp(callData, signature);
    await laser.sendUserOp(callData, signature);

    console.log(" - - - - e x e c u t i n g - - - - - - - - -- - ");
    await new Promise(f => setTimeout(f, 40000));

    console.log("receiver new balance:", utils.formatEther(await laser.bal(receiver.address)));

    const _walletPostBalance = await laser.walletBalance();
    const walletPostBalance = utils.formatEther(_walletPostBalance);

    const txBal = Number(initialBalance) - Number(utils.formatEther(value));
    const txCost = txBal - Number(walletPostBalance);

    console.log("wallet post balance:", walletPostBalance);
    console.log("tx cost: ", txCost, "ETH");
}




