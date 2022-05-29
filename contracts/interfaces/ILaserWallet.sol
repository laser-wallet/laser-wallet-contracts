// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.14;

import {UserOperation} from "../libraries/UserOperation.sol";

/**
 * @title ILaserWallet
 * @notice External functions of LaserWallet.sol.
 * @author Rodrigo Herrera I.
 */
interface ILaserWallet {
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
     * @dev Returns the chain id of this.
     */
    function getChainId() external view returns (uint256);

    /**
     * @dev Returns the domain separator of this.
     * @notice This is done to avoid replay attacks.
     */
    function domainSeparator() external view returns (bytes32);

    /**
     * @dev Returns the user operation hash to be signed by owners.
     * @param userOp The UserOperation struct.
     */
    function userOperationHash(UserOperation calldata userOp) external view returns (bytes32);

    /**
     * @dev Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * @param hash Hash of a message signed on behalf of address(this).
     * @param signature Signature byte array associated with _msgHash.
     * @return Magic value  or reverts with an error message.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external returns (bytes4);
}
