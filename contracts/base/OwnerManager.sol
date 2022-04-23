// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "../common/SelfAuthorized.sol";

/**
 * @title OwnerManager - Manages a set of owners and a threshold to perform actions.
 * @author Modified from Gnosis Safe.
 */
contract OwnerManager is SelfAuthorized {
    event AddedOwner(address owner);
    event AddedSpecialOwner(address specialOwner);
    event RemovedOwner(address owner);
    event RemovedSpecialOwner(address specialOwner);
    event ChangedThreshold(uint256 threshold);

    address internal constant SENTINEL_OWNERS = address(0x1);

    mapping(address => address) internal owners;
    // specialOwners are owners that can execute any transaction with only one signature (their signature).
    // by design, all specialOwners are also owners.
    mapping(address => bool) internal specialOwners;

    uint256 internal ownerCount;
    uint256 internal specialOwnerCount;
    uint256 internal threshold;

    /**
     * @dev Setup function sets initial storage of contract.
     * @param _owners List of Safe owners.
     * @param _specialOwners List of special owners. Special owners are also owners, therefore special owners
     * need to be inside of the _owners array as well.
     * @param _threshold Number of required confirmations for a Safe transaction.
     */
    function setupOwners(
        address[] memory _owners,
        address[] memory _specialOwners,
        uint256 _threshold
    ) internal {
        // Saving variables in function scope to avoid loading multiple times.
        uint256 ownersLength = _owners.length;
        uint256 specialOwnersLength = _specialOwners.length;
        // Threshold can only be 0 at initialization.
        // Check ensures that setup function can only be called once.
        require(threshold == 0, "OM: Wallet already initialized");
        // Validate that threshold is smaller than number of added owners.
        require(_threshold <= _owners.length, "OM: Threshold too big");
        require(specialOwnersLength <= ownersLength, "Too many special owners");
        // There has to be at least one Safe owner.
        require(_threshold >= 1, "OM: Threshold needs to be at least 1");
        // Initializing Safe owners.
        address currentOwner = SENTINEL_OWNERS;
        for (uint256 i = 0; i < ownersLength; i++) {
            // Owner address cannot be null.
            address owner = _owners[i];
            require(
                owner != address(0) &&
                    owner != SENTINEL_OWNERS &&
                    owner != address(this) &&
                    currentOwner != owner &&
                    owner.code.length == 0,
                "Invalid owner"
            );
            // No duplicate owners allowed.
            require(owners[owner] == address(0), "OM: Duplicate owner");
            owners[currentOwner] = owner;
            currentOwner = owner;
        }
        owners[currentOwner] = SENTINEL_OWNERS;
        ownerCount = ownersLength;
        threshold = _threshold;
        if (specialOwnersLength > 0) {
            for (uint256 i = 0; i < specialOwnersLength; i++) {
                address specialOwner = _specialOwners[i];
                require(
                    owners[specialOwner] != address(0),
                    "OM: Invalid special owner: not an owner"
                );
                require(
                    !specialOwners[specialOwner],
                    "OM: Duplicate special owner"
                );
                specialOwners[specialOwner] = true;
            }
        }
        specialOwnerCount = specialOwnersLength;
    }

    /**
     * @dev Allows to add a new owner to the Safe and update the threshold at the same time.
     * This can only be done via a Safe transaction.
     * @notice Adds the owner `owner` to the Safe and updates the threshold to `_threshold`.
     * @param _owner New owner address.
     * @param _threshold New threshold.
     */
    function addOwnerWithThreshold(address _owner, uint256 _threshold)
        public
        authorized
    {
        // Owner address cannot be null, the sentinel or the Safe itself.
        require(
            _owner != address(0) &&
                _owner != SENTINEL_OWNERS &&
                _owner != address(this) &&
                _owner.code.length == 0,
            "OM: Invalid owner"
        );
        // No duplicate owners allowed.
        require(owners[_owner] == address(0), "OM: Duplicate owner");
        owners[_owner] = owners[SENTINEL_OWNERS];
        owners[SENTINEL_OWNERS] = _owner;
        ownerCount++;
        emit AddedOwner(_owner);
        // Change threshold if threshold was changed.
        if (threshold != _threshold) changeThreshold(_threshold);
    }

    /**
     * @dev Allows to remove an owner from the Safe and update the threshold at the same time.
     * This can only be done via a Safe transaction.
     * @notice Removes the owner `owner` from the Safe and updates the threshold to `_threshold`.
     * If the owner to be removed is also a special owner, it will also be removed from the special owners.
     * @param _prevOwner Owner that pointed to the owner to be removed in the linked list
     * @param _owner Owner address to be removed.
     * @param _threshold New threshold.
     */
    function removeOwner(
        address _prevOwner,
        address _owner,
        uint256 _threshold
    ) public authorized {
        // Only allow to remove an owner, if threshold can still be reached.
        require(ownerCount - 1 >= _threshold, "OM: Invalid owner count");
        // Validate owner address and check that it corresponds to owner index.
        require(
            _owner != address(0) && _owner != SENTINEL_OWNERS,
            "Invalid owner"
        );
        require(owners[_prevOwner] == _owner, "OM: Invalid prevOwner");
        owners[_prevOwner] = owners[_owner];
        owners[_owner] = address(0);
        if (specialOwners[_owner]) {
            removeSpecialOwner(_owner);
        }
        ownerCount--;
        emit RemovedOwner(_owner);
        // Change threshold if threshold was changed.
        if (threshold != _threshold) changeThreshold(_threshold);
    }

    /**
     * @dev Allows to update the number of required confirmations by Safe owners.
     * This can only be done via a Safe transaction.
     * @notice Changes the threshold of the Safe to `_threshold`.
     * @param _threshold New threshold.
     */
    function changeThreshold(uint256 _threshold) public authorized {
        // Validate that threshold is smaller than number of owners.
        require(
            _threshold <= ownerCount,
            "OM: Threshold cannot exceed owner count"
        );
        // There has to be at least one Safe owner.
        require(_threshold >= 1, "OM: Threshold cannot be 0");
        threshold = _threshold;
        emit ChangedThreshold(threshold);
    }

    /**
     * @dev Adds a special owner. Special owners can execute transactions with only one signature.
     * If the address 'specialOwner' was not previously an owner, it will first be added as an owner
     * and then as a special owner.
     * @param _specialOwner address to be upgraded as a special owner.
     */
    function addSpecialOwner(address _specialOwner) public authorized {
        require(!specialOwners[_specialOwner], "OM: Duplicate special owner");
        if (owners[_specialOwner] == address(0)) {
            addOwnerWithThreshold(_specialOwner, threshold);
        }
        // We don't need to do additional checks, they were already done because _specialOwner is now an owner.
        specialOwners[_specialOwner] = true;
        specialOwnerCount++;
        emit AddedSpecialOwner(_specialOwner);
    }

    /**
     * @dev Allows to remove a special owner from the wallet.
     * This can only be done via a Safe transaction.
     * @notice Removes the special owner from the wallet.
     * This transaction will only remove the owner as a special owner, but it will remain an owner.
     * @param _specialOwner Special owner address to be removed.
     */
    function removeSpecialOwner(address _specialOwner) public authorized {
        require(specialOwners[_specialOwner], "OM: Not a special owner");
        specialOwners[_specialOwner] = false;
        specialOwnerCount--;
        emit RemovedSpecialOwner(_specialOwner);
    }

    /**
     * @return Current threshold of this wallet.
     */
    function getThreshold() public view returns (uint256) {
        return threshold;
    }

    /**
     * @param _specialOwner the requested address.
     * @return boolean if the address is a special owner.
     */
    function isSpecialOwner(address _specialOwner) public view returns (bool) {
        return specialOwners[_specialOwner];
    }

    /**
     * @param _owner the requested address.
     * @return boolean if the address provided is an owner.
     */
    function isOwner(address _owner) public view returns (bool) {
        return _owner != SENTINEL_OWNERS && owners[_owner] != address(0);
    }

    /**
     * @dev Returns array of special owners.
     * @return Array of special owners.
     */
    function getSpecialOwners() public view returns (address[] memory) {
        address[] memory array = new address[](specialOwnerCount);
        uint256 index = 0;
        address currentOwner = owners[SENTINEL_OWNERS];
        while (currentOwner != SENTINEL_OWNERS) {
            if (specialOwners[currentOwner]) {
                array[index] = currentOwner;
                index++;
            }
            currentOwner = owners[currentOwner];
        }
        return array;
    }

    /**
     * @dev Returns array of owners.
     * @return Array of Safe owners.
     */
    function getOwners() public view returns (address[] memory) {
        address[] memory array = new address[](ownerCount);

        // populate return array
        uint256 index = 0;
        address currentOwner = owners[SENTINEL_OWNERS];
        while (currentOwner != SENTINEL_OWNERS) {
            array[index] = currentOwner;
            currentOwner = owners[currentOwner];
            index++;
        }
        return array;
    }
}
