import { BigNumber, ethers, Signer, Wallet, Contract } from 'ethers';
import { Domain, types } from '../types/EIP712';
import { TxMessage, LaserOp, userOp, SafeTx } from '../types';

export async function signTypedData(
    signer: Wallet,
    domain: Domain,
    destination: string,
    _value?: BigNumber | string | number,
    _data?: string,
    _nonce?: number
): Promise<string> {
    const txMessage = {
        to: destination,
        value: _value ? _value : 0,
        data: _data ? _data : '0x',
        nonce: _nonce ? _nonce : 0,
    };
    const signature = await signer._signTypedData(domain, types, txMessage);
    return signature;
}

export async function EIP712Sig(
    signer: Wallet,
    domain: Domain,
    txMessage: LaserOp
): Promise<string> {
    const signature = await signer._signTypedData(domain, types, txMessage);
    return signature;
}

export async function sign(signer: Signer, hash: string): Promise<string> {
    const typedDataHash = ethers.utils.arrayify(hash);
    const signature = (await signer.signMessage(typedDataHash))
        .replace(/1b$/, '1f')
        .replace(/1c$/, '20');
    return signature;
}

export async function internalSignature(
    signer: Wallet,
    internalTx: SafeTx,
    wallet: Contract
): Promise<string> {
    const hash = await wallet.getTransactionHash(
        internalTx.to,
        internalTx.value,
        internalTx.data,
        0
    );
    return await sign(signer, hash);
}
