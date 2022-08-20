// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.16;

import "./interfaces/ILaserGuard.sol";
import "./interfaces/ILaserWallet.sol";
import "./state/LaserState.sol";

/**
 * @title  LaserWallet
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Laser is a modular smart contract wallet made for the Ethereum Virtual Machine.
 *         It has modularity (programmability) and security at its core.
 */
contract LaserWallet is ILaserWallet, LaserState {
    /*//////////////////////////////////////////////////////////////
                            Laser metadata
    //////////////////////////////////////////////////////////////*/

    string public constant VERSION = "1.0.0";

    string public constant NAME = "Laser Wallet";

    /*//////////////////////////////////////////////////////////////
                        Signature constant helpers
    //////////////////////////////////////////////////////////////*/

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant LASER_TYPE_STRUCTURE =
        keccak256("LaserOperation(address to,uint256 value,bytes callData,uint256 nonce)");

    /**
     * @dev Sets the owner of the implementation address (singleton) to 'this'.
     *      This will make the base contract unusable, even though it does not have 'delegatecall'.
     */
    constructor() {
        owner = address(this);
    }

    receive() external payable {}

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
    ) external {
        // activateWallet verifies that the current owner is address 0, reverts otherwise.
        // This is more than enough to avoid being called after initialization.

        bytes32 signedHash = keccak256(abi.encodePacked(_guardians, _recoveryOwners, block.chainid, address(this)));

        address signer = Utils.returnSigner(signedHash, ownerSignature, 0);
        if (signer != _owner) revert LW__init__notOwner();

        //emit Setup(_owner, laserModule);
    }

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
    ) public returns (bool success) {
        // We immediately increase the nonce to avoid replay attacks.
        unchecked {
            if (nonce++ != _nonce) revert LW__exec__invalidNonce();
        }

        // If the wallet is locked, further transactions cannot be executed from 'exec'.
        if (isLocked) revert LW__exec__walletLocked();

        // We get the hash for this transaction.
        bytes32 signedHash = keccak256(encodeOperation(to, value, callData, _nonce));

        address signer1 = Utils.returnSigner(signedHash, signatures, 0);
        address signer2 = Utils.returnSigner(signedHash, signatures, 1);

        // Signer1 must be the owner.
        if (signer1 != owner) revert LW__exec__notOwner();

        // We execute the main transaction but we keep 10_000 units of gas for the remaining operations.
        success = Utils.call(to, value, callData, gasleft());

        require(success, "failed");

        if (success) emit ExecSuccess(to, value, nonce);
        else emit ExecFailure(to, value, nonce);
    }

    /**
     * @notice Executes a batch of transactions.
     *
     * @param transactions An array of Laser transactions.
     */
    function multiCall(Transaction[] calldata transactions) external {
        uint256 transactionsLength = transactions.length;

        //@todo custom errors and optimization.
        for (uint256 i = 0; i < transactionsLength; ) {
            Transaction calldata transaction = transactions[i];

            exec(transaction.to, transaction.value, transaction.callData, transaction.nonce, transaction.signatures);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Returns the hash to be signed to execute a transaction.
     */
    function operationHash(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce
    ) external view returns (bytes32) {
        return keccak256(encodeOperation(to, value, callData, _nonce));
    }

    /**
     * @notice Implementation of EIP1271. Laser does not support it due to the fact
     *         that it acts as a secure vault, only for storage purposes.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        revert LaserWallet__notSupported();
    }

    /**
     * @return chainId The chain id of this.
     */
    function getChainId() public view returns (uint256 chainId) {
        return block.chainid;
    }

    /**
     * @notice Domain separator for this wallet.
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, getChainId(), address(this)));
    }

    /**
     * @notice Encodes the transaction data.
     */
    function encodeOperation(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce
    ) internal view returns (bytes memory) {
        bytes32 opHash = keccak256(abi.encode(LASER_TYPE_STRUCTURE, to, value, keccak256(callData), _nonce));

        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), opHash);
    }
}
