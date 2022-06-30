// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

/**
 * @title ILaserWallet
 * @author Rodrigo Herrera I.
 * @notice Has all the external functions, structs, events and errors for LaserWallet.sol.
 */
interface ILaserWallet {
    event Received(address indexed sender, uint256 amount);
    event Setup(address owner, address[] recoveryOwners, address[] guardians);
    event ExecSuccess(address to, uint256 value, uint256 nonce);
    event ExecFailure(address to, uint256 value, uint256 nonce);

    ///@dev exec() custom errors.
    error LW__exec__gasTipOverflow();
    error LW__exec__invalidNonce();
    error LW__exec__refundFailure();

    ///@dev simulateTransaction() custom errors.
    error LW__simulateTransaction__invalidNonce();
    error LW__simulateTransaction__mainCallError();
    error LW__simulateTransaction__refundFailure();

    ///@dev isValidSignature() Laser custom error.
    error LaserWallet__invalidSignature();

    struct Transaction {
        address to;
        uint256 value;
        bytes callData;
    }

    /**
     * @dev Setup function, sets initial storage of contract.
     * @param owner The owner of the wallet.
     * @param recoveryOwners Array of recovery owners. Implementation of Sovereign Social Recovery.
     * @param guardians Addresses that can activate the social recovery mechanism.
     * @notice It can't be called after initialization.
     */
    function init(
        address owner,
        address[] calldata recoveryOwners,
        address[] calldata guardians
    ) external;

    /**
     * @dev Executes a generic transaction. It does not support 'delegatecall' for security reasons.
     * @param to Destination address.
     * @param value Amount to send.
     * @param callData Data payload for the transaction.
     * @param _nonce Unsigned integer to avoid replay attacks. It needs to match the current wallet's nonce.
     * @param maxFeePerGas Maximum amount that the user is willing to pay for a unit of gas.
     * @param maxPriorityFeePerGas Miner's tip.
     * @param signatures The signatures of the transaction.
     */
    function exec(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasTip,
        bytes calldata signatures
    ) external;

    /**
     * @dev Simulates a transaction. This should be called from the relayer, to verify that the transaction will not revert.
     * This does not guarantees 100% that the transaction will succeed, the state will be different next block.
     * @notice Needs to be called off-chain from  address zero.
     */
    function simulateTransaction(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasTip,
        bytes calldata signatures
    ) external returns (uint256 totalGas);

    /**
     * @dev The transaction's hash. This is necessary to check that the signatures are correct and to avoid replay attacks.
     */
    function operationHash(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasTip
    ) external view returns (bytes32);

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
