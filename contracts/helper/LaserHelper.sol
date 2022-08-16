// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.16;

import "../interfaces/ILaserModuleSSR.sol";
import "../interfaces/ILaserState.sol";

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
        ILaserState laser = ILaserState(wallet);
        ILaserModuleSSR ssr = ILaserModuleSSR(SSRModule);
        owner = laser.owner();
        singleton = laser.singleton();
        isLocked = laser.isLocked();
        guardians = ssr.getGuardians(wallet);
        recoveryOwners = ssr.getRecoveryOwners(wallet);
        nonce = laser.nonce();
        balance = address(wallet).balance;
        timeLock = ssr.getWalletTimeLock(wallet);
    }
}
