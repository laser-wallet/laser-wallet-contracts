// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "hardhat/console.sol";

interface ILaser {
    function owner() external view returns (address);

    function singleton() external view returns (address);

    function timeLock() external view returns (uint256);

    function isLocked() external view returns (bool);

    function nonce() external view returns (uint256);
}

interface ILaserModuleSSR {
    function getRecoveryOwners(address wallet) external view returns (address[] memory);

    function getGuardians(address wallet) external view returns (address[] memory);

    function getWalletTimeLock(address wallet) external view returns (uint256);
}

///@title LaserHelper - Helper contract that outputs multiple results in a single call.
contract LaserHelper {
    ///@dev Returns the wallet state + SSR module.
    function getWalletState(address wallet, address SSRModule)
        external
        view
        returns (
            address owner,
            address singleton,
            bool isLocked,
            address[] memory guardians,
            address[] memory recoveryOwners,
            uint256 nonce,
            uint256 balance,
            uint256 timeLock
        )
    {
        ILaser laser = ILaser(wallet);
        ILaserModuleSSR laserModule = ILaserModuleSSR(SSRModule);
        owner = laser.owner();
        singleton = laser.singleton();
        isLocked = laser.isLocked();
        guardians = laserModule.getGuardians(wallet);
        recoveryOwners = laserModule.getRecoveryOwners(wallet);
        nonce = laser.nonce();
        balance = address(wallet).balance;
        timeLock = laserModule.getWalletTimeLock(wallet);
    }

    ///@dev Simulates a transaction.
    ///@notice The simulation reverts if the main transaction fails.
    ///It needs to be called off-chain from address zero.
    function simulateTransaction(
        address to,
        bytes calldata callData,
        uint256 gasLimit
    ) external returns (uint256 totalGas) {
        require(to.code.length > 2, "target address must be a contract");
        (bool success, ) = to.call(callData);
        console.log("success -->", success);
        console.log("bal -->", address(to).balance);
        require(success, "main call failed.");
        gasLimit = (gasLimit * 63) / 64;

        totalGas = gasLimit - gasleft();
        require(msg.sender == address(0), "Must be called off-chain from address zero.");
    }
}
