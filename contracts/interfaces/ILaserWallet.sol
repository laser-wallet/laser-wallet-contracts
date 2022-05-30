// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.14;

import {UserOperation} from "../libraries/UserOperation.sol";

/**
 * @title ILaserWallet
 * @author Rodrigo Herrera I.
 * @notice Has all the external functions, structs, events and errors for LaserWallet.sol.
 */
interface ILaserWallet {
    /**
     * @dev Generic transaction struct primarily used for multicall.
     */
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
    }

    event Setup(address owner, address[] guardians, address entryPoint);
    event Success(address to, uint256 value);
    event Received(address indexed sender, uint256 amount);
    event GuardianSuccess(bytes4 funcSelector);
    event MultiCallSuccess();

    ///@dev modifier error.
    error LW__notEntryPoint();

    ///@dev validateUserOp() custom errors.
    error LW__validateUserOp__invalidNonce();
    error LW__validateUserOp__notOwner();
    error LW__validateUserOp__walletLocked();
    error LW__validateUserOp__notGuardian();
    error LW__validateUserOp__invalidFuncSelector();

    ///@dev exec() custom errors.
    error LW__exec__ownerNotAllowed();
    error LW__exec__failure();

    ///@dev guardianCall() custom errors.
    error LW__guardianCall__failure();
    error LW__guardianCall__guardianNotAllowed();

    ///@dev multiCall() custom errrors.
    error LW__multiCall__ownerNotAllowed();
    error LW__multiCall__failure();

    ///@dev emergencyCall() custom errors.
    error LW__emergencyCall__ownerNotAllowed();
    error LW__emergencyCall__guardianNotAllowed();
    error LW__emergencyCall__invalidCaller();
    error LW__emergencyCall__failure();

    ///@dev isValidSignature() custom error.
    error LW__isValidSignature__invalidSigner();

    /**
     * @dev Setup function, sets initial storage of contract.
     * @param owner The owner of the wallet.
     * @param guardians Addresses that can activate the social recovery mechanism.
     * @param entryPoint Entry Point contract address.
     * @notice It can't be called after initialization.
     */
    function init(
        address owner,
        address[] calldata guardians,
        address entryPoint
    ) external;

    /**
     * @dev Core interface to be EIP4337 compliant.
     * @param userOp the operation to be executed.
     * @param _requiredPrefund the minimum amount to transfer to the sender(entryPoint) to be able to make the call.
     * @notice only the EntryPoint contract can call this function.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 _requiredPrefund
    ) external;

    /**
     * @dev Executes an AA transaction. The msg.sender needs to be the EntryPoint address.
     * The signatures are verified in validateUserOp().
     * @ param to Destination address of Safe transaction.
     * @param value Ether value of Safe transaction.
     * @param callData Data payload of Safe transaction.
     * @notice only the EntryPoint or owner can call this function.
     */
    function exec(
        address to,
        uint256 value,
        bytes calldata callData
    ) external;

    /**
     * @dev Starts the SSR mechanism. Can only be called by a guardian.
     * @param data Data payload for this transaction. It is limited to guardian access.
     */
    function guardianCall(bytes memory data) external;

    /**
     * @dev Executes a series of transactions.
     * @param transactions populated array of transactions.
     * @notice If any transaction fails, the whole multiCall reverts.
     */
    function multiCall(Transaction[] calldata transactions) external;

    /**
     * @dev Executes a transaction.
     * @param to Destination address of the transaction.
     * @param value Ether value of the transaction.
     * @param data Data payload of the transaction.
     * @notice This function is implemented in the case of a bug in the EntryPoint contract.
     * So there is a direct interaction with this.
     */
    function emergencyCall(
        address to,
        uint256 value,
        bytes memory data
    ) external;

    /**
     * @dev Returns the user operation hash to be signed by owners.
     * @param userOp The UserOperation struct.
     */
    function userOperationHash(UserOperation calldata userOp)
        external
        view
        returns (bytes32);

    /**
     * @dev Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * @param hash Hash of a message signed on behalf of address(this).
     * @param signature Signature byte array associated with _msgHash.
     * @return Magic value  or reverts with an error message.
     */
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        returns (bytes4);

    /**
     * @dev Returns the chain id of this.
     */
    function getChainId() external view returns (uint256);

    /**
     * @dev Returns the domain separator of this.
     * @notice This is done to avoid replay attacks.
     */
    function domainSeparator() external view returns (bytes32);
}
