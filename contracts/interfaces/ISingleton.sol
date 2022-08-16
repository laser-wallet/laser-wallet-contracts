// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.16;

///@title ISingleton
///@notice Has all the external functions, events and errors for Singleton.sol.
interface ISingleton {
    event SingletonChanged(address indexed newSingleton);

    ///@dev upgradeSingleton() custom errors.
    error Singleton__upgradeSingleton__incorrectAddress();
    error Singleton__upgradeSingleton__notLaser();

    ///@dev Migrates to a new singleton (implementation).
    function upgradeSingleton(address singleton) external;
}
