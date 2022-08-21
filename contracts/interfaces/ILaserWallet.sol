// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.16;

/**
 * @title  ILaserWallet
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Laser is a modular smart contract wallet made for the Ethereum Virtual Machine.
 *         It has modularity (programmability) and security at its core.
 *
 * @dev    This interface has all events, errors, and external function for LaserWallet.
 */
interface ILaserWallet {
    event Setup(address owner, address laserModule);
    event ExecSuccess(address to, uint256 value, uint256 nonce);
    event ExecFailure(address to, uint256 value, uint256 nonce);

    // init() custom errors.
    error LW__init__notOwner();
    error LW__init__refundFailure();

    // exec() custom errors.
    error LW__exec__invalidNonce();
    error LW__exec__walletLocked();
    error LW__exec__notOwner();
    error LW__exec__refundFailure();

    // execFromModule() custom errors.
    error LW__execFromModule__unauthorizedModule();
    error LW__execFromModule__mainCallFailed();
    error LW__execFromModule__refundFailure();

    // simulateTransaction() custom errors.
    error LW__SIMULATION__invalidNonce();
    error LW__SIMULATION__walletLocked();
    error LW__SIMULATION__notOwner();
    error LW__SIMULATION__refundFailure();

    // isValidSignature() Laser custom error.
    error LaserWallet__invalidSignature();

    struct Transaction {
        address to;
        uint256 value;
        bytes callData;
        uint256 nonce;
        bytes signatures;
    }

    /**
     * @notice Setup function, sets initial storage of the wallet.
     *         It can't be called after initialization.
     *
     * @param _owner           The owner of the wallet.
     * @param ownerSignature   Signature of the owner that validates approval for initialization.
     */
    function init(
        address _owner,
        address[] calldata _guardians,
        address[] calldata _recoveryOwners,
        bytes calldata ownerSignature
    ) external;

    /**
     * @notice Executes a generic transaction.
     *         If 'gasLimit' does not match the actual gas limit of the transaction, the relayer can incur losses.
     *         It is the relayer's responsability to make sure that they are the same,
     *         the user does not get affected if a mistake is made.
     *
     * @param to                    Destination address.
     * @param value                 Amount in WEI to transfer.
     * @param callData              Data payload for the transaction.
     * @param _nonce                Anti-replay number.
     * @param signatures            The signature(s) of the hash of this transaction.
     */
    function exec(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        bytes calldata signatures
    ) external returns (bool success);

    /**
     * @notice Should return whether the signature provided is valid for the provided hash.
     *
     * @param hash      Hash of the data to be signed.
     * @param signature Signature byte array associated with hash.
     *
     * MUST return the bytes4 magic value 0x1626ba7e when function passes.
     * MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc > 0.5)
     * MUST allow external calls
     *
     * @return Magic value if signature matches the owner's address and the wallet is not locked.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4);

    /**
     * @notice Returns the hash to be signed to execute a transaction.
     */
    function operationHash(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce
    ) external view returns (bytes32);

    /**
     * @return chainId The chain id of this.
     */
    function getChainId() external view returns (uint256 chainId);

    /**
     * @notice Domain separator for this wallet.
     */
    function domainSeparator() external view returns (bytes32);
}
