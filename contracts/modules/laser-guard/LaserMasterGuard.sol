// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../../common/Utils.sol";
import "../../interfaces/ILaserGuard.sol";
import "../../interfaces/ILaserMasterGuard.sol";
import "../../interfaces/ILaserModuleSSR.sol";
import "../../interfaces/ILaserRegistry.sol";

/**
 * @title LaserMasterGuard
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Parent guard module that calls child Laser guards.
 */
contract LaserMasterGuard is ILaserMasterGuard {
    /*//////////////////////////////////////////////////////////////
                            Constans
    //////////////////////////////////////////////////////////////*/
    address private constant POINTER = address(0x1);

    address public immutable LASER_REGISTRY;

    address public immutable LASER_SMART_SOCIAL_RECOVERY;

    /*//////////////////////////////////////////////////////////////
                        LaserMasterGuard's storage
    //////////////////////////////////////////////////////////////*/

    mapping(address => uint256) internal guardModulesCount;

    mapping(address => mapping(address => address)) internal guardModules;

    /**
     * @param laserRegistry         Address of LaserRegistry: contract that contains the addresses
     *                              of authorized modules.
     * @param smartSocialRecovery   Address of Laser smart social recovery module.
     */
    constructor(address laserRegistry, address smartSocialRecovery) {
        LASER_REGISTRY = laserRegistry;
        //@todo Check that the smart social recovery is registred in LaserRegistry.
        LASER_SMART_SOCIAL_RECOVERY = smartSocialRecovery;
    }

    /**
     * @notice Adds a new guard module.
     *         wallet is 'msg.sender'.
     *
     * @param module The address of the new module. It needs to be authorized in LaserRegistry.
     */
    function addGuardModule(address module) external {
        address wallet = msg.sender;

        if (!ILaserRegistry(LASER_REGISTRY).isModule(module)) {
            revert LaserMasterGuard__addGuardModule__unauthorizedModule();
        }

        if (guardModulesCount[wallet] == 0) {
            initGuardModule(wallet, module);
        } else {
            guardModules[wallet][module] = guardModules[wallet][POINTER];
            guardModules[wallet][POINTER] = module;
        }

        unchecked {
            ++guardModulesCount[wallet];
        }

        if (guardModulesCount[wallet] == 4) revert LaserMasterGuard__addGuardModule__overflow();
    }

    /**
     * @notice Removes a guard module.
     * wallet is 'msg.sender'.
     *
     * @param prevModule    The address of the previous module on the linked list.
     * @param module        The address of the module to remove.
     */
    function removeGuardModule(
        address prevModule,
        address module,
        bytes calldata guardianSignature
    ) external {
        address wallet = msg.sender;

        bytes32 signedHash = keccak256(abi.encodePacked(module, block.chainid));

        address signer = Utils.returnSigner(signedHash, guardianSignature, 0);

        require(ILaserModuleSSR(LASER_SMART_SOCIAL_RECOVERY).isGuardian(wallet, signer), "Invalid guardian signature");

        if (guardModules[wallet][module] == address(0)) {
            revert LaserMasterGuard__removeGuardModule__incorrectModule();
        }

        if (module == POINTER) {
            revert LaserMasterGuard__removeGuardModule__incorrectModule();
        }

        if (guardModules[wallet][prevModule] != module) {
            revert LaserMasterGuard__removeGuardModule__incorrectPrevModule();
        }

        guardModules[wallet][prevModule] = guardModules[wallet][module];
        guardModules[wallet][module] = address(0);

        guardModulesCount[wallet]--;
    }

    /**
     * @notice Verifies a Laser transaction.
     *         It calls all guard sub-modules with the 'verifyTransaction api'.
     *         Each sub-module implements its own logic. But the main purpose is to
     *         provide extra transaction security.
     *
     * @param wallet                The address of the wallet: should be 'msg.sender'.
     * @param to                    Destination address.
     * @param value                 Amount in WEI to transfer.
     * @param callData              Data payload for the transaction.
     * @param nonce                 Anti-replay number.
     * @param maxFeePerGas          Maximum WEI the owner is willing to pay per unit of gas.
     * @param maxPriorityFeePerGas  Miner's tip.
     * @param gasLimit              Maximum amount of gas the owner is willing to use for this transaction.
     * @param signatures            The signature(s) of the hash of this transaction.
     */
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

            address guard;

            for (uint256 i = 0; i < modulesLength; ) {
                guard = walletGuardModules[i];
                // @todo Optimize this.
                ILaserGuard(guard).verifyTransaction(
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

    /**
     * @param wallet The requested address.
     *
     * @return The guard modules that belong to the requested address.
     */
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

    /**
     * @notice Inits the guard modules for a specific wallet.
     *
     * @param  wallet  Address of the wallet to init the guard module.
     * @param  module  Address of the module to init.
     */
    function initGuardModule(address wallet, address module) internal {
        guardModules[wallet][POINTER] = module;
        guardModules[wallet][module] = POINTER;
    }
}
