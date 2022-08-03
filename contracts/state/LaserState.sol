// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../access/Access.sol";
import "../common/Utils.sol";
import "../interfaces/IERC165.sol";
import "../interfaces/ILaserState.sol";
import "../interfaces/ILaserRegistry.sol";

contract LaserState is Access, ILaserState {
    address internal constant pointer = address(0x1);

    address public singleton;

    address public owner;

    address public laserMasterGuard;

    address public laserRegistry;

    bool public isLocked;

    uint256 public nonce;

    mapping(address => address) internal laserModules;

    ///@notice Restricted, can only be called by the wallet or module.
    function changeOwner(address newOwner) external access {
        owner = newOwner;
    }

    ///@notice Restricted, can only be called by the wallet.
    function addLaserModule(address newModule) external access {
        require(ILaserRegistry(laserRegistry).isModule(newModule), "Invalid new module");
        laserModules[newModule] = laserModules[pointer];
        laserModules[pointer] = newModule;
    }

    function upgradeSingleton(address _singleton) external access {
        //@todo Change require for custom errrors.
        require(_singleton != address(this), "Invalid singleton");
        require(ILaserRegistry(laserRegistry).isSingleton(_singleton), "Invalid master copy");
        singleton = _singleton;
    }

    function activateWallet(
        address _owner,
        address laserModule,
        address _masterGuard,
        address _laserRegistry,
        bytes calldata laserModuleData
    ) internal {
        // If owner is not address 0, the wallet was already initialized.
        if (owner != address(0)) revert LaserState__initOwner__walletInitialized();

        if (_owner.code.length != 0 || _owner == address(0)) revert LaserState__initOwner__invalidAddress();

        // We set the owner.
        owner = _owner;

        // check that the module is accepted.
        laserMasterGuard = _masterGuard;
        laserRegistry = _laserRegistry;

        if (laserModule != address(0)) {
            require(ILaserRegistry(laserRegistry).isModule(laserModule), "Module not authorized");
            bool success = Utils.call(laserModule, 0, laserModuleData, gasleft());
            require(success);
            laserModules[laserModule] = pointer;
        }
    }
}
