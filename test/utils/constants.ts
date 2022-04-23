import { ethers } from "ethers";

export const SENTINEL = "0x0000000000000000000000000000000000000001";

export const VERSION = "1.0.0";

export const addressZero = ethers.constants.AddressZero;

export const fakeSignature =
    "0x077a6aed99cbc3d7c8ba7ab843e58525afdc272ac8e5818f99d4925bd5162f4c13b00ba03cf00cdfb83b39787a4a78a72236590eb982cafb9cf22f83d90cf4291b";

export const specialOwner = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);

export const owner1 = new ethers.Wallet(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
);

export const owner2 = new ethers.Wallet(
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
);

export const owner3 = new ethers.Wallet(
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
);

export const oneEth = ethers.utils.parseEther("1");
