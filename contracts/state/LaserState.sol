// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.16;

import "../access/Access.sol";
import "../common/Utils.sol";
import "../interfaces/IERC165.sol";
import "../interfaces/ILaserState.sol";

import "hardhat/console.sol";

contract LaserState is ILaserState, Access {
    address internal constant POINTER = address(0x1); // POINTER for the link list.

    /*//////////////////////////////////////////////////////////////
                          LASER WALLET STORAGE
    //////////////////////////////////////////////////////////////*/

    address public singleton;

    address public owner;

    uint256 public nonce;

    uint256 internal guardianCount;

    uint256 internal recoveryOwnerCount;

    mapping(address => address) public guardians;

    mapping(address => address) public recoveryOwners;

    WalletConfig walletConfig;

    /**
     * @notice Locks the wallet. Can only be called by a recovery owner + recovery owner
     *         or recovery owner + guardian.
     *
     * @dev    Restricted, can only be called by address(this).
     */
    function lock() external access {
        walletConfig.isLocked = true;
        walletConfig.timestamp = block.timestamp;

        emit WalletLocked();
    }

    /**
     * @notice Unlocks the wallet. Can only be called by the owner + recovery owner
     *         or owner + guardian.
     *
     * @dev    Restricted, can only be called by address(this).
     */
    function unlock() external access {
        walletConfig.isLocked = false;
        walletConfig.timestamp = 0;

        emit WalletUnlocked();
    }

    /**
     * @notice Recovers the wallet. Can only be called by the recovery owner + recovery owner
     *         or recovery owner + guardian.
     *
     * @dev   Restricted, can only be called by address(this).
     *
     * @param newOwner  Address of the new owner.
     */
    function recover(address newOwner) external access {
        uint256 elapsedTime = block.timestamp - walletConfig.timestamp;
        //@todo custom errors.
        require(elapsedTime > 5 days);

        require(newOwner.code.length == 0 && newOwner != owner && newOwner != address(0));
        owner = newOwner;

        emit WalletRecovered(newOwner);
    }

    /**
     * @notice Changes the owner of the wallet. Can only be called by the owner + recovery owner
     *         or owner + guardian.
     *
     * @dev   Restricted, can only be called by address(this).
     *
     * @param newOwner  Address of the new owner.
     */
    function changeOwner(address newOwner) external access {
        require(newOwner.code.length == 0 && newOwner != owner && newOwner != address(0));
        owner = newOwner;
        emit OwnerChanged(newOwner);
    }

    function changeSingleton(address newSingleton) external access {
        //@todo Change require for custom errrors.
        require(newSingleton != address(this), "Invalid singleton");
        singleton = newSingleton;
        emit SingletonChanged(newSingleton);
    }

    function addGuardian(address newGuardian) external access {
        if (
            newGuardian == address(0) ||
            newGuardian == owner ||
            guardians[newGuardian] != address(0) ||
            recoveryOwners[newGuardian] != address(0) ||
            newGuardian == POINTER
        ) revert LS__addGuardian__invalidAddress();

        if (newGuardian.code.length > 0) {
            if (!IERC165(newGuardian).supportsInterface(0x1626ba7e)) {
                revert LS__addGuardian__invalidAddress();
            }
        }

        guardians[newGuardian] = guardians[POINTER];
        guardians[POINTER] = newGuardian;

        unchecked {
            guardianCount++;
        }

        emit NewGuardian(newGuardian);
    }

    function removeGuardian(address prevGuardian, address guardianToRemove) external access {
        if (guardianToRemove == POINTER) {
            revert LS__removeGuardian__invalidAddress();
        }

        if (guardians[prevGuardian] != guardianToRemove) {
            revert LS__removeGuardian__incorrectPreviousGuardian();
        }

        // There needs to be at least 1 guardian.
        if (guardianCount - 1 < 1) revert LS__removeGuardian__underflow();

        guardians[prevGuardian] = guardians[guardianToRemove];
        guardians[guardianToRemove] = address(0);

        unchecked {
            guardianCount--;
        }

        emit GuardianRemoved(guardianToRemove);
    }

    function addRecoveryOwner(address newRecoveryOwner) external access {
        if (
            newRecoveryOwner == address(0) ||
            newRecoveryOwner == owner ||
            recoveryOwners[newRecoveryOwner] != address(0) ||
            guardians[newRecoveryOwner] != address(0) ||
            newRecoveryOwner == POINTER
        ) revert LS__addGuardian__invalidAddress();

        if (newRecoveryOwner.code.length > 0) {
            if (!IERC165(newRecoveryOwner).supportsInterface(0x1626ba7e)) {
                //@todo change the error.
                revert LS__addGuardian__invalidAddress();
            }
        }

        recoveryOwners[newRecoveryOwner] = recoveryOwners[POINTER];
        recoveryOwners[POINTER] = newRecoveryOwner;

        unchecked {
            recoveryOwnerCount++;
        }

        emit NewRecoveryOwner(newRecoveryOwner);
    }

    function removeRecoveryOwner(address prevRecoveryOwner, address recoveryOwnerToRemove) external access {
        if (recoveryOwnerToRemove == POINTER) {
            revert LS__removeGuardian__invalidAddress();
        }

        if (recoveryOwners[prevRecoveryOwner] != recoveryOwnerToRemove) {
            //@todo change the error
            revert LS__removeGuardian__incorrectPreviousGuardian();
        }

        // There needs to be at least 1 recovery owner.
        if (recoveryOwnerCount - 1 < 1) revert LS__removeGuardian__underflow();

        recoveryOwners[prevRecoveryOwner] = recoveryOwners[recoveryOwnerToRemove];
        recoveryOwners[recoveryOwnerToRemove] = address(0);

        unchecked {
            recoveryOwnerCount--;
        }

        emit RecoveryOwnerRemoved(recoveryOwnerToRemove);
    }

    function getGuardians() external view returns (address[] memory) {
        address[] memory guardiansArray = new address[](guardianCount);
        address currentGuardian = guardians[POINTER];

        uint256 index = 0;
        while (currentGuardian != POINTER) {
            guardiansArray[index] = currentGuardian;
            currentGuardian = guardians[currentGuardian];
            index++;
        }
        return guardiansArray;
    }

    function getRecoveryOwners() external view returns (address[] memory) {
        address[] memory recoveryOwnersArray = new address[](recoveryOwnerCount);
        address currentRecoveryOwner = recoveryOwners[POINTER];

        uint256 index = 0;
        while (currentRecoveryOwner != POINTER) {
            recoveryOwnersArray[index] = currentRecoveryOwner;
            currentRecoveryOwner = recoveryOwners[currentRecoveryOwner];
            index++;
        }
        return recoveryOwnersArray;
    }

    function isLocked() external view returns (bool) {
        return walletConfig.isLocked;
    }

    function getConfigTimestamp() external view returns (uint256) {
        return walletConfig.timestamp;
    }

    function initGuardians(address[] calldata _guardians) internal {
        uint256 guardiansLength = _guardians.length;
        // There needs to be at least 1 guardian.
        if (guardiansLength < 1) revert LS__initGuardians__underflow();

        address currentGuardian = POINTER;

        for (uint256 i = 0; i < guardiansLength; ) {
            address guardian = _guardians[i];
            if (
                guardian == owner ||
                guardian == address(0) ||
                guardian == POINTER ||
                guardian == currentGuardian ||
                guardians[guardian] != address(0)
            ) revert LS__initGuardians__invalidAddress();

            if (guardian.code.length > 0) {
                // If the guardian is a smart contract wallet, it needs to support EIP1271.
                if (!IERC165(guardian).supportsInterface(0x1626ba7e)) {
                    revert LS__initGuardians__invalidAddress();
                }
            }

            unchecked {
                i++;
            }
            guardians[currentGuardian] = guardian;
            currentGuardian = guardian;
        }

        guardians[currentGuardian] = POINTER;
        guardianCount = guardiansLength;
    }

    function initRecoveryOwners(address[] calldata _recoveryOwners) internal {
        uint256 recoveryOwnersLength = _recoveryOwners.length;
        // @todo custom errors.
        require(recoveryOwnersLength >= 1);
        address currentRecoveryOwner = POINTER;

        for (uint256 i = 0; i < recoveryOwnersLength; ) {
            address recoveryOwner = _recoveryOwners[i];
            if (
                recoveryOwner == owner ||
                recoveryOwner == address(0) ||
                recoveryOwner == POINTER ||
                recoveryOwner == currentRecoveryOwner ||
                recoveryOwners[recoveryOwner] != address(0) ||
                guardians[recoveryOwner] != address(0)
                //@todo change this error
            ) revert LS__initGuardians__invalidAddress();

            if (recoveryOwner.code.length > 0) {
                // If the recovery owner is a smart contract wallet, it needs to support EIP1271.
                if (!IERC165(recoveryOwner).supportsInterface(0x1626ba7e)) {
                    // @todo change this error.
                    revert LS__initGuardians__invalidAddress();
                }
            }

            unchecked {
                i++;
            }
            recoveryOwners[currentRecoveryOwner] = recoveryOwner;
            currentRecoveryOwner = recoveryOwner;
        }

        recoveryOwners[currentRecoveryOwner] = POINTER;
        recoveryOwnerCount = recoveryOwnersLength;
    }

    function activateWallet(
        address _owner,
        address[] calldata _guardians,
        address[] calldata _recoveryOwners
    ) internal {
        if (owner != address(0)) revert LS__initOwner__walletInitialized();

        // @todo custom errors.
        require(_owner.code.length == 0);

        // We set the owner. There is no need for further verification.
        owner = _owner;

        // We init the guardians.
        initGuardians(_guardians);

        // We init the recovery owners.
        initRecoveryOwners(_recoveryOwners);
    }
}
