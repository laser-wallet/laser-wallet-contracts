// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../../common/Common.sol";
import "../../common/Utils.sol";

interface ILaser {
    function nonce() external view returns (uint256);

    function owner() external view returns (address);

    function execFromModule(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer
    ) external;
}

/**
 * @dev Implementation of Smart Social Recovery.
 */
contract LaserModuleSSR is Common {
    address internal constant pointer = address(0x1);

    mapping(address => uint256) internal recoveryOwnerCount;
    mapping(address => uint256) internal guardianCount;
    mapping(address => mapping(address => address)) internal recoveryOwners;
    mapping(address => mapping(address => address)) internal guardians;

    /**
     * @dev Inits the module.
     */
    function initSSR(address[] calldata _guardians, address[] calldata _recoveryOwners) external {
        address wallet = msg.sender;

        initGuardians(wallet, _guardians);
        initRecoveryOwners(wallet, _recoveryOwners);
    }

    /**
     * @dev Unlocks the target wallet.
     * @notice Can only be called with the signature of the wallet's owner + a guardian.
     */
    function unlock(
        address wallet,
        bytes calldata callData,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes memory signatures
    ) external {
        uint256 walletNonce = ILaser(wallet).nonce();
        bytes32 signedHash = keccak256(
            encodeOperation(wallet, 0, callData, walletNonce + 1, maxFeePerGas, maxPriorityFeePerGas, gasLimit)
        );

        address walletOwner = ILaser(wallet).owner();
        require(walletOwner != address(0));

        address signer1 = Utils.returnSigner(signedHash, signatures, 0);
        require(signer1 == walletOwner);

        address signer2 = Utils.returnSigner(signedHash, signatures, 0);
        require(guardians[wallet][signer2] != address(0));

        ILaser(wallet).execFromModule(wallet, 0, callData, maxFeePerGas, maxPriorityFeePerGas, gasLimit, relayer);
    }

    function initGuardians(address wallet, address[] calldata _guardians) internal {
        uint256 guardiansLength = _guardians.length;

        address currentGuardian = pointer;

        for (uint256 i = 0; i < guardiansLength; ) {
            address guardian = _guardians[i];

            guardians[wallet][currentGuardian] = guardian;
            currentGuardian = guardian;

            unchecked {
                ++i;
            }
        }

        guardians[wallet][currentGuardian] = pointer;
        guardianCount[wallet] = guardiansLength;
    }

    function initRecoveryOwners(address wallet, address[] calldata _recoveryOwners) internal {
        uint256 recoveryOwnersLength = _recoveryOwners.length;

        address currentRecoveryOwner = pointer;

        for (uint256 i = 0; i < recoveryOwnersLength; ) {
            address recoveryOwner = _recoveryOwners[i];

            recoveryOwners[wallet][currentRecoveryOwner] = recoveryOwner;
            currentRecoveryOwner = recoveryOwner;

            unchecked {
                ++i;
            }
        }

        recoveryOwners[wallet][currentRecoveryOwner] = pointer;
        recoveryOwnerCount[wallet] = recoveryOwnersLength;
    }
}
