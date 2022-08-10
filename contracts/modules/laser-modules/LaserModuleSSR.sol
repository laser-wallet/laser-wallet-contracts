// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../../common/Utils.sol";
import "../../interfaces/ILaserModuleSSR.sol";
import "../../interfaces/ILaserState.sol";
import "../../interfaces/ILaserWallet.sol";

////////////
///// TODO: Adding and removing a guardian or recovery owner should
// only be allowed when the wallet is unlocked.
contract LaserModuleSSR is ILaserModuleSSR {
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant LASER_MODULE_SSR_TYPE_STRUCTURE =
        keccak256(
            "LaserModuleSSR(address wallet,bytes callData,uint256 walletNonce,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 gasLimit"
        );

    ///@dev POINTER to create a mapping link list.
    address internal constant POINTER = address(0x1);

    ///@dev timeLock keeps track of the recovery time delay. It gets set to 'block.timestamp' when 'lock' is triggered.
    mapping(address => uint256) internal timeLock;

    mapping(address => uint256) internal recoveryOwnerCount;

    mapping(address => uint256) internal guardianCount;

    mapping(address => mapping(address => address)) internal recoveryOwners;

    mapping(address => mapping(address => address)) internal guardians;

    modifier onlyWallet(address wallet) {
        if (msg.sender != wallet) revert SSR__onlyWallet__notWallet();

        _;
    }

    ///@dev Inits the module.
    ///@notice The target wallet is the 'msg.sender'.
    function initSSR(address[] calldata _guardians, address[] calldata _recoveryOwners) external {
        address wallet = msg.sender;

        initGuardians(wallet, _guardians);
        initRecoveryOwners(wallet, _recoveryOwners);
    }

    ///@dev Locks the target wallet.
    ///Can only be called by the recovery owner + guardian.
    function lock(
        address wallet,
        bytes calldata callData,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes memory signatures
    ) external {
        uint256 walletNonce = ILaserState(wallet).nonce();

        bytes32 signedHash = keccak256(
            encodeOperation(wallet, callData, walletNonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit)
        );

        require(bytes4(callData) == bytes4(keccak256("lock()")), "should be the same!");

        address signer1 = Utils.returnSigner(signedHash, signatures, 0);
        require(recoveryOwners[wallet][signer1] != address(0));

        address signer2 = Utils.returnSigner(signedHash, signatures, 1);
        require(guardians[wallet][signer2] != address(0));

        timeLock[wallet] = block.timestamp;

        ILaserWallet(wallet).execFromModule(wallet, 0, callData, maxFeePerGas, maxPriorityFeePerGas, gasLimit, relayer);
    }

    /**
     * @dev Unlocks the target wallet.
     * @notice Can only be called with the signature of the wallet's owner + recovery owner or  owner + guardian.
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
        uint256 walletNonce = ILaserState(wallet).nonce();

        bytes32 signedHash = keccak256(
            encodeOperation(wallet, callData, walletNonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit)
        );

        require(bytes4(callData) == bytes4(keccak256("unlock()")), "should be the same!");

        address walletOwner = ILaserState(wallet).owner();
        require(walletOwner != address(0));

        address signer1 = Utils.returnSigner(signedHash, signatures, 0);
        require(signer1 == walletOwner);

        address signer2 = Utils.returnSigner(signedHash, signatures, 1);
        require(
            guardians[wallet][signer2] != address(0) || recoveryOwners[wallet][signer2] != address(0),
            "nop signer2"
        );

        timeLock[wallet] = 0;
        ILaserWallet(wallet).execFromModule(wallet, 0, callData, maxFeePerGas, maxPriorityFeePerGas, gasLimit, relayer);
    }

    function recover(
        address wallet,
        bytes calldata callData,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes memory signatures
    ) external {
        uint256 walletNonce = ILaserState(wallet).nonce();

        bytes32 signedHash = keccak256(
            encodeOperation(wallet, callData, walletNonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit)
        );

        require(bytes4(callData) == bytes4(keccak256("changeOwner(address)")), "should be change owner.");

        address signer1 = Utils.returnSigner(signedHash, signatures, 0);
        require(recoveryOwners[wallet][signer1] != address(0));

        address signer2 = Utils.returnSigner(signedHash, signatures, 1);
        require(guardians[wallet][signer2] != address(0), "nop signer2");

        require(timeLock[wallet] + 1 weeks < block.timestamp, "incorrect time");
        timeLock[wallet] = 0;
        ILaserWallet(wallet).execFromModule(wallet, 0, callData, maxFeePerGas, maxPriorityFeePerGas, gasLimit, relayer);
    }

    function addGuardian(address wallet, address newGuardian) external onlyWallet(wallet) {
        verifyNewRecoveryOwnerOrGuardian(wallet, newGuardian);
        guardians[wallet][newGuardian] = guardians[wallet][POINTER];
        guardians[wallet][POINTER] = newGuardian;

        unchecked {
            guardianCount[wallet]++;
        }
    }

    function removeGuardian(
        address wallet,
        address prevGuardian,
        address guardianToRemove
    ) external onlyWallet(wallet) {
        // There needs to be at least 1 guardian.
        if (guardianCount[wallet] < 2) revert SSR__removeGuardian__underflow();

        if (guardianToRemove == POINTER) revert SSR__removeGuardian__invalidAddress();

        if (guardians[wallet][prevGuardian] != guardianToRemove)
            revert SSR__removeGuardian__incorrectPreviousGuardian();

        guardians[wallet][prevGuardian] = guardians[wallet][guardianToRemove];
        guardians[wallet][guardianToRemove] = address(0);

        unchecked {
            // Can't underflow, there needs to be more than 2 guardians to reach here.
            guardianCount[wallet]--;
        }
    }

    function swapGuardian(
        address wallet,
        address prevGuardian,
        address newGuardian,
        address oldGuardian
    ) external onlyWallet(wallet) {
        verifyNewRecoveryOwnerOrGuardian(wallet, newGuardian);

        if (guardians[wallet][prevGuardian] != oldGuardian) revert SSR__swapGuardian__invalidPrevGuardian();

        if (oldGuardian == POINTER) revert SSR__swapGuardian__invalidOldGuardian();

        guardians[wallet][newGuardian] = guardians[wallet][oldGuardian];
        guardians[wallet][prevGuardian] = newGuardian;
        guardians[wallet][oldGuardian] = address(0);
    }

    function addRecoveryOwner(address wallet, address newRecoveryOwner) external onlyWallet(wallet) {
        verifyNewRecoveryOwnerOrGuardian(wallet, newRecoveryOwner);
        recoveryOwners[wallet][newRecoveryOwner] = recoveryOwners[wallet][POINTER];
        recoveryOwners[wallet][POINTER] = newRecoveryOwner;

        unchecked {
            recoveryOwnerCount[wallet]++;
        }
    }

    function removeRecoveryOwner(
        address wallet,
        address prevRecoveryOwner,
        address recoveryOwnerToRemove
    ) external onlyWallet(wallet) {
        // There needs to be at least 1 recovery owner.
        if (recoveryOwnerCount[wallet] < 2) revert SSR__removeRecoveryOwner__underflow();

        if (recoveryOwnerToRemove == POINTER) revert SSR__removeRecoveryOwner__invalidAddress();

        if (recoveryOwners[wallet][prevRecoveryOwner] != recoveryOwnerToRemove) {
            revert SSR__removeRecoveryOwner__incorrectPreviousRecoveryOwner();
        }

        recoveryOwners[wallet][prevRecoveryOwner] = recoveryOwners[wallet][recoveryOwnerToRemove];
        recoveryOwners[wallet][recoveryOwnerToRemove] = address(0);

        unchecked {
            // Can't underflow, there needs to be more than 2 guardians to reach here.
            recoveryOwnerCount[wallet]--;
        }
    }

    function swapRecoveryOwner(
        address wallet,
        address prevRecoveryOwner,
        address newRecoveryOwner,
        address oldRecoveryOwner
    ) external onlyWallet(wallet) {
        verifyNewRecoveryOwnerOrGuardian(wallet, newRecoveryOwner);
        if (recoveryOwners[wallet][prevRecoveryOwner] != oldRecoveryOwner) {
            revert SSR__swapRecoveryOwner__invalidPrevRecoveryOwner();
        }

        if (oldRecoveryOwner == POINTER) revert SSR__swapRecoveryOwner__invalidOldRecoveryOwner();

        recoveryOwners[wallet][newRecoveryOwner] = recoveryOwners[wallet][oldRecoveryOwner];
        recoveryOwners[wallet][prevRecoveryOwner] = newRecoveryOwner;
        recoveryOwners[wallet][oldRecoveryOwner] = address(0);
    }

    function getGuardians(address wallet) external view returns (address[] memory) {
        address[] memory guardiansArray = new address[](guardianCount[wallet]);
        address currentGuardian = guardians[wallet][POINTER];

        uint256 index;
        while (currentGuardian != POINTER) {
            guardiansArray[index] = currentGuardian;
            currentGuardian = guardians[wallet][currentGuardian];
            unchecked {
                ++index;
            }
        }
        return guardiansArray;
    }

    function getRecoveryOwners(address wallet) external view returns (address[] memory) {
        address[] memory recoveryOwnersArray = new address[](recoveryOwnerCount[wallet]);
        address currentRecoveryOwner = recoveryOwners[wallet][POINTER];

        uint256 index;
        while (currentRecoveryOwner != POINTER) {
            recoveryOwnersArray[index] = currentRecoveryOwner;
            currentRecoveryOwner = recoveryOwners[wallet][currentRecoveryOwner];
            unchecked {
                ++index;
            }
        }
        return recoveryOwnersArray;
    }

    function getWalletTimeLock(address wallet) external view returns (uint256) {
        return timeLock[wallet];
    }

    function isGuardian(address wallet, address guardian) external view returns (bool) {
        return guardians[wallet][guardian] != address(0) && guardian != POINTER;
    }

    function initGuardians(address wallet, address[] calldata _guardians) internal {
        uint256 guardiansLength = _guardians.length;

        if (guardiansLength < 1) revert SSR__initGuardians__underflow();

        address currentGuardian = POINTER;
        address guardian;

        for (uint256 i = 0; i < guardiansLength; ) {
            guardian = _guardians[i];

            guardians[wallet][currentGuardian] = guardian;
            currentGuardian = guardian;

            verifyNewRecoveryOwnerOrGuardian(wallet, guardian);

            unchecked {
                ++i;
            }
        }

        guardians[wallet][currentGuardian] = POINTER;
        guardianCount[wallet] = guardiansLength;
    }

    ///@dev Inits the recovery owners for the target wallet.
    ///@param wallet The target wallet address.
    ///@param _recoveryOwners Array of the recovery owners addresses.
    function initRecoveryOwners(address wallet, address[] calldata _recoveryOwners) internal {
        uint256 recoveryOwnersLength = _recoveryOwners.length;

        if (recoveryOwnersLength < 1) revert SSR__initRecoveryOwners__underflow();

        address currentRecoveryOwner = POINTER;
        address recoveryOwner;

        for (uint256 i = 0; i < recoveryOwnersLength; ) {
            recoveryOwner = _recoveryOwners[i];

            recoveryOwners[wallet][currentRecoveryOwner] = recoveryOwner;
            currentRecoveryOwner = recoveryOwner;

            verifyNewRecoveryOwnerOrGuardian(wallet, recoveryOwner);

            unchecked {
                ++i;
            }
        }

        recoveryOwners[wallet][currentRecoveryOwner] = POINTER;
        recoveryOwnerCount[wallet] = recoveryOwnersLength;
    }

    function verifyNewRecoveryOwnerOrGuardian(address wallet, address toVerify) internal view {
        address owner = ILaserState(wallet).owner();

        if (toVerify.code.length > 0) {
            // If the recovery owner is a smart contract wallet, it needs to support EIP1271.
            if (!IERC165(toVerify).supportsInterface(0x1626ba7e)) {
                revert SSR__verifyNewRecoveryOwnerOrGuardian__invalidAddress();
            }
        }
        if (
            toVerify == address(0) ||
            toVerify == owner ||
            guardians[wallet][toVerify] != address(0) ||
            recoveryOwners[wallet][toVerify] != address(0)
        ) revert SSR__verifyNewRecoveryOwnerOrGuardian__invalidAddress();
    }

    ///@dev Returns the chain id of this.
    function getChainId() public view returns (uint256 chainId) {
        return block.chainid;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, getChainId(), address(this)));
    }

    function encodeOperation(
        address wallet,
        bytes calldata callData,
        uint256 walletNonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit
    ) internal view returns (bytes memory) {
        bytes32 opHash = keccak256(
            abi.encode(
                LASER_MODULE_SSR_TYPE_STRUCTURE,
                wallet,
                keccak256(callData),
                walletNonce,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasLimit
            )
        );

        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), opHash);
    }

    function operationHash(
        address wallet,
        bytes calldata callData,
        uint256 walletNonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit
    ) external view returns (bytes32) {
        return keccak256(encodeOperation(wallet, callData, walletNonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit));
    }
}
