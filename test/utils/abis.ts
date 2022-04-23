export const erc20Abi = [
    "function approve(address spender, uint rawAmount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint)",
    "function transfer(address dst, uint rawAmount) external returns (bool)",
    "function balanceOfUnderlying(address account) external view returns (uint)",
    "function borrowBalanceCurrent(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function name() external view returns (string memory)"
];
