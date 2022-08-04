// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../../interfaces/ILaserRegistry.sol";

interface IGuard {
    function verifyTransaction(
        address wallet,
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        bytes calldata signature
    ) external;
}

/**
 * @title LaserMasterGuard
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Parent guard module that calls child Laser guards.
 */
contract LaserMasterGuard {
    address private constant POINTER = address(0x1);

    address public immutable LASER_REGISTRY;

    mapping(address => uint256) internal guardModulesCount;
    mapping(address => mapping(address => address)) internal guardModules;

    constructor(address _LASER_REGISTRY) {
        LASER_REGISTRY = _LASER_REGISTRY;
    }

    function addGuardModule(address module) external {
        //@todo Check that the module is a contract that supports this.
        require(ILaserRegistry(LASER_REGISTRY).isModule(module), "Unauthorized module");
        address wallet = msg.sender;
        guardModules[wallet][module] = guardModules[wallet][POINTER];
        guardModules[wallet][POINTER] = module;

        unchecked {
            ++guardModulesCount[wallet];
        }

        require(guardModulesCount[wallet] < 4, "Only 3 guard modules allowed per wallet");
    }

    function removeGuardModule(address prevModule, address module) external {
        address wallet = msg.sender;

        //@todo custom errors instead of require statement.
        require(guardModules[wallet][module] != address(0), "Module not found");
        require(module != POINTER, "incorrect");

        require(guardModules[wallet][prevModule] == module);

        guardModules[wallet][prevModule] = guardModules[wallet][module];
        guardModules[wallet][module] = address(0);

        unchecked {
            guardModulesCount[wallet]--;
        }
    }

    function verifyTransaction(
        address wallet,
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        bytes memory signatures
    ) external {
        if (guardModulesCount[wallet] > 0) {
            address[] memory walletGuardModules = getGuardModules(wallet);
            uint256 modulesLength = walletGuardModules.length;

            for (uint256 i = 0; i < modulesLength; ) {
                address guard = walletGuardModules[i];

                IGuard(guard).verifyTransaction(
                    wallet,
                    to,
                    value,
                    callData,
                    nonce,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    gasLimit,
                    signatures
                );

                unchecked {
                    ++i;
                }
            }
        }
    }

    function getGuardModules(address wallet) public view returns (address[] memory) {
        address[] memory guardModulesArray = new address[](guardModulesCount[wallet]);
        address currentGuardModule = guardModules[wallet][POINTER];

        uint256 index;
        while (currentGuardModule != POINTER) {
            guardModulesArray[index] = currentGuardModule;
            currentGuardModule = guardModules[wallet][currentGuardModule];
            unchecked {
                ++index;
            }
        }
        return guardModulesArray;
    }
}
