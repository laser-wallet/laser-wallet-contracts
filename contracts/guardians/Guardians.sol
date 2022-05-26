// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "../core/SelfAuthorized.sol";
import "../core/Owner.sol";

import "hardhat/console.sol";

contract Guardians is SelfAuthorized, Owner {
    struct Confirmations {
        uint256 approvals;
        mapping(address => bool) signed;
    }

    bool public isLocked;

    address internal constant pointer = address(0x1);

    uint256 public guardianCount;

    mapping(address => address) internal guardians;
    mapping(Recovery => Confirmations) private confirmations;

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
    event SuccesfullRecovery(address newOwner);

    modifier isNotLocked() {
        if (isLocked) {
            revert Guardian__WalletIsLocked();
        }
        _;
    }

    /**
     * @dev Locks the wallet. It can only be done by a guardian.
     */
    function lock() public isNotLocked authorized {
        isLocked = true;
        emit WalletLocked();
    }

    /**
     * @dev Unlocks the wallet after the threshold is reached.
     */
    function unlock() public authorized {
        if (!isLocked) {
            revert Guardian__WalletIsNotLocked();
        }
        uint256 threshold = necessaryApprovals();
        Confirmations storage conf = confirmations[Recovery.Unlock];
        if (conf.signed[msg.sender]) {
            revert Guardian__AlreadyApproved();
        }
        conf.approvals++;
        conf.signed[msg.sender] = true;
        if (threshold == conf.approvals) {
            isLocked = false;
            delete confirmations[Recovery.Unlock];
            emit WalletUnlocked();
        }
    }

    function recover(address newOwner) public authorized {
        if (!isLocked) revert Guardian__WalletIsNotLocked();
        if (
            newOwner == owner ||
            newOwner.code.length != 0 ||
            newOwner == address(0)
        ) revert Owner__InvalidOwnerAddress();
        owner = newOwner;
        emit SuccesfullRecovery(newOwner);
    }

    /**
     * @dev Sets up the initial guardian configuration. Can only be called from the init function.
     * @param _guardians Array of guardians.
     */
    function initGuardians(address[] calldata _guardians) internal {
        if (_guardians.length < 1) {
            revert Guardian__ZeroGuardians();
        }
        address currentGuardian = pointer;
        for (uint256 i = 0; i < _guardians.length; i++) {
            address guardian = _guardians[i];
            if (
                guardian == owner ||
                guardian == address(0) ||
                guardian == pointer ||
                guardian == address(this) ||
                guardian == currentGuardian ||
                guardians[guardian] != address(0)
            ) {
                revert Guardian__InvalidGuardianAddress();
            }
            guardians[currentGuardian] = guardian;
            currentGuardian = guardian;
        }
        guardians[currentGuardian] = pointer;
        guardianCount = _guardians.length;
    }

    /**
     * @dev Adds a guardian to the wallet.
     * @param newGuardian Address of the new guardian.
     */
    function addGuardian(address newGuardian) public authorized {
        if (
            newGuardian == address(0) ||
            newGuardian == pointer ||
            newGuardian == address(this) ||
            newGuardian == owner ||
            guardians[newGuardian] != address(0)
        ) revert Guardian__InvalidGuardianAddress();
        guardians[newGuardian] = guardians[pointer];
        guardians[pointer] = newGuardian;
        guardianCount++;
        emit NewGuardian(newGuardian);
    }

    function removeGuardian(address prevGuardian, address guardianToRemove)
        public
        authorized
    {
        if (guardianToRemove == address(0) || guardianToRemove == pointer) {
            revert Guardian__InvalidGuardianAddress();
        }
        if (guardians[prevGuardian] != guardianToRemove) {
            revert Guardian__IncorrectPreviousGuardian();
        }
        guardians[prevGuardian] = guardians[guardianToRemove];
        guardians[guardianToRemove] = address(0);
        guardianCount--;
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
        if (guardianCount == 0) {
            revert Guardian__NoGuardians();
        }
        address[] memory guardiansArray = new address[](guardianCount);

        uint256 index = 0;
        address currentGuardian = guardians[pointer];
        while (currentGuardian != pointer) {
            guardiansArray[index] = currentGuardian;
            currentGuardian = guardians[currentGuardian];
            index++;
        }
        return guardiansArray;
    }

    function necessaryApprovals() public view returns (uint256) {
        // ceil(g / 2).
        // except the case of 2 / 2.
        if (guardianCount % 2 == 0) {
            if (guardianCount == 2) {
                return 2;
            } else {
                return guardianCount / 2;
            }
        }
        return guardianCount / 2 + 1;
    }

    function isGuardianCall(bytes4 funcSig) public pure returns (bool) {
        return
            funcSig == this.lock.selector ||
            funcSig == this.unlock.selector ||
            funcSig == this.recover.selector;
    }
}
