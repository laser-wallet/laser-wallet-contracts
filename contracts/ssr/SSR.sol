// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

import "../core/SelfAuthorized.sol";
import "../core/Owner.sol";
import "../interfaces/IERC165.sol";

/**
 * @title SSR - Sovereign Social Recovery
 * @notice New wallet recovery mechanism.
 * @author Rodrigo Herrera I.
 */
contract SSR is SelfAuthorized, Owner {
    ///@dev recovery owner should always be at storage slot 3.
    address public recoveryOwner;
    ///@dev pointer address for the nested mapping.
    address internal constant pointer = address(0x1);

    uint256 public guardianCount;

    bool public isLocked;

    ///@dev Determines who has access to call a specific function.
    enum Access {
        Owner,
        Guardian,
        RecoveryOwnerAndGuardian
    }

    mapping(address => address) internal guardians;

    error Guardian__ZeroGuardians();
    error Guardian__InvalidGuardianAddress();
    error Guardian__NotGuardian();
    error Guardian__NoGuardians();
    error Guardian__WalletIsLocked();
    error Guardian__WalletIsNotLocked();
    error Guardian__IncorrectPreviousGuardian();
    error Guardian__AlreadyApproved();

    event WalletLocked();
    event WalletUnlocked();
    event NewGuardian(address newGuardian);
    event GuardianRemoved(address removedGuardian);
    event SuccesfullRecovery(address owner, address recoveryOwner);
    event NewRecoveryOwner(address recoveryOwner);

    modifier isNotLocked() {
        if (isLocked) revert Guardian__WalletIsLocked();

        _;
    }

    /**
     * @dev Locks the wallet. Can only be called by a guardian.
     * @notice When the wallet is locked, we assume that the owner lost access
     * to his/her device.
     */
    function lock() external authorized isNotLocked {
        isLocked = true;
        emit WalletLocked();
    }

    /**
     * @dev Unlocks the wallet. Can only be called by a guardian + the owner.
     */
    function unlock() external authorized {
        if (!isLocked) revert Guardian__WalletIsNotLocked();
        isLocked = false;
    }

    /**
     * @dev Can only recover with the signature of 1 guardian and the recovery owner.
     * @param newOwner The new owner address. This is generated instantaneously.
     * @param newRecoveryOwner The new recovery owner address. This is generated instantaneously.
     * @notice The newOwner and newRecoveryOwner key pair should be generated from the mobile device.
     * The main reason of this is to restart the generation process in case an attacker has the current recoveryOwner.
     */
    function recover(address newOwner, address newRecoveryOwner)
        external
        authorized
    {
        if (!isLocked) revert Guardian__WalletIsNotLocked();
        owner = newOwner;
        recoveryOwner = newRecoveryOwner;
        emit SuccesfullRecovery(owner, recoveryOwner);
    }

    /**
     * @dev Changes the recoveryOwner address. Only the owner can call this function.
     * @param newRecoveryOwner The new recovery owner address.
     */
    function changeRecoveryOwner(address newRecoveryOwner) external authorized {
        recoveryOwner = newRecoveryOwner;
        emit NewRecoveryOwner(recoveryOwner);
    }

    /**
     * @dev Sets up the initial guardian configuration. Can only be called from the init function.
     * @param _guardians Array of guardians.
     */
    function initGuardians(address[] calldata _guardians) internal {
        uint256 guardiansLength = _guardians.length;
        if (guardiansLength < 1) revert Guardian__ZeroGuardians();

        address currentGuardian = pointer;

        for (uint256 i = 0; i < guardiansLength; ) {
            address guardian = _guardians[i];
            if (
                guardian == owner ||
                guardian == address(0) ||
                guardian == pointer ||
                guardian == address(this) ||
                guardian == currentGuardian ||
                guardians[guardian] != address(0)
            ) revert Guardian__InvalidGuardianAddress();
            unchecked {
                // Won't overflow...
                ++i;
            }
            guardians[currentGuardian] = guardian;
            currentGuardian = guardian;
        }

        guardians[currentGuardian] = pointer;
        guardianCount = guardiansLength;
    }

    /**
     * @dev Adds a guardian to the wallet.
     * @param newGuardian Address of the new guardian.
     * @notice Can only be called by the owner.
     */
    function addGuardian(address newGuardian) external authorized {
        if (
            newGuardian == address(0) ||
            newGuardian == pointer ||
            newGuardian == address(this) ||
            newGuardian == owner ||
            guardians[newGuardian] != address(0)
        ) revert Guardian__InvalidGuardianAddress();

        // Guardians can only be either EOA or Laser.
        // Untill EIP1271 is more widely adopted ...
        if (newGuardian.code.length > 0) {
            if (!IERC165(newGuardian).supportsInterface(0xae029e0b)) {
                revert Guardian__InvalidGuardianAddress();
            }
        }

        guardians[newGuardian] = guardians[pointer];
        guardians[pointer] = newGuardian;

        unchecked {
            // Won't overflow...
            ++guardianCount;
        }
        emit NewGuardian(newGuardian);
    }

    /**
     * @dev Removes a guardian to the wallet.
     * @param prevGuardian Address of the previous guardian in the linked list.
     * @param guardianToRemove Address of the guardian to be removed.
     * @notice Can only be called by the owner.
     */
    function removeGuardian(address prevGuardian, address guardianToRemove)
        external
        authorized
    {
        if (guardianToRemove == address(0) || guardianToRemove == pointer)
            revert Guardian__InvalidGuardianAddress();

        if (guardians[prevGuardian] != guardianToRemove)
            revert Guardian__IncorrectPreviousGuardian();

        guardians[prevGuardian] = guardians[guardianToRemove];
        guardians[guardianToRemove] = address(0);
        unchecked {
            //Won't underflow...
            --guardianCount;
        }
        emit GuardianRemoved(guardianToRemove);
    }

    /**
     * @param guardian Requested address.
     * @return Boolean if the address is a guardian of the current wallet.
     */
    function isGuardian(address guardian) external view returns (bool) {
        return guardian != pointer && guardians[guardian] != address(0);
    }

    /**
     * @return Array of guardians or reverts with custom error if there are no guardians.
     */
    function getGuardians() external view returns (address[] memory) {
        if (guardianCount == 0) revert Guardian__NoGuardians();

        address[] memory guardiansArray = new address[](guardianCount);
        address currentGuardian = guardians[pointer];

        uint256 index = 0;
        while (currentGuardian != pointer) {
            guardiansArray[index] = currentGuardian;
            currentGuardian = guardians[currentGuardian];
            index++;
        }
        return guardiansArray;
    }

    function access(bytes4 funcSelector) public pure returns (Access) {
        if (funcSelector == this.lock.selector) {
            return Access.Guardian;
        } else if (funcSelector == this.recover.selector) {
            return Access.RecoveryOwnerAndGuardian;
        } else {
            return Access.Owner;
        }
    }
}
