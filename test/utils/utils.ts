
import { ethers, Wallet } from "ethers";
import { Domain, types, TxMessage } from "../types";


export const encodeFunctionData = (abi: any, functionName: string, ..._params: any[]): string => {
    const params = _params[0];
    const iface = new ethers.utils.Interface(abi);
    const data = iface.encodeFunctionData(functionName, params);
    return data;
}


export const signMessage = async (signer:Wallet, domain:Domain, txMessage: TxMessage) : Promise<string> => {
    const signature = await signer._signTypedData(domain, types, txMessage);
    return signature.slice(2,);
}

export const paddedSignature = (_address: string): string => {
    const address = _address.slice(2,);
    const signatureVerifier = "000000000000000000000000" + address;
    const dataPosition = "00000000000000000000000000000000000000000000000000000000000000000";
    const signatureType = "1";
    const signature = signatureVerifier + dataPosition + signatureType;
    return "0x" + signature;
}
