// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "./core/Singleton.sol";
import "./handlers/Handler.sol";
import "./interfaces/ILaserWallet.sol";
import "./ssr/SSR.sol";

import "hardhat/console.sol";

/**
 * @title LaserWallet - EVM based smart contract wallet. Implementes "sovereign social recovery" mechanism and account abstraction.
 * @author Rodrigo Herrera I.
 */
contract LaserWallet is Singleton, SSR, Handler, ILaserWallet {
    string public constant VERSION = "1.0.0";

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");
    bytes32 private constant LASER_TYPE_STRUCTURE =
        keccak256(
            "LaserOperation(address to,uint256 value,bytes callData,uint256 nonce,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 gasTip)"
        );
    bytes4 private constant EIP1271_MAGIC_VALUE =
        bytes4(keccak256("isValidSignature(bytes32,bytes)"));

    uint256 public nonce;

    constructor() {
        // This makes the singleton unusable. e.g. (parity wallet hack).
        owner = address(this);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /**
     * @dev Setup function, sets initial storage of contract.
     * @param _owner The owner of the wallet.
     * @param _recoveryOwner Recovery owner in case the owner looses the main device. Implementation of Sovereign Social Recovery.
     * @param _guardians Addresses that can activate the social recovery mechanism.
     * @notice It can't be called after initialization.
     */
    function init(
        address _owner,
        address _recoveryOwner,
        address[] calldata _guardians
    ) external {
        // initOwner() requires that the current owner is address 0.
        // This is enough to protect init() from being called after initialization.
        initOwners(_owner, _recoveryOwner);
        initGuardians(_guardians);
        emit Setup(owner, _recoveryOwner, _guardians);
    }

    function exec(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasTip,
        bytes calldata signatures
    ) external {
        // This is just for a quick trial, the userOp needs to change.
        uint256 initialGas = gasleft();
        // We immediately increase the nonce to avoid replay attacks.
        if (nonce++ != _nonce) revert LW__validateUserOp__invalidNonce();

        // We verify that the signatures are correct ...
        verifyTransaction(
            to,
            value,
            callData,
            _nonce,
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasTip,
            signatures
        );

        // We execute the main transaction ...
        bool success = _call(to, value, callData, gasleft());

        // If the transaction returns false, we revert ...
        if (!success) revert LW__exec__failure();

        // We calculate the gas price, as per the user's request ...
        uint256 gasPrice = calculateGasPrice(
            maxFeePerGas,
            maxPriorityFeePerGas
        );

        // We check the amount of gas the transaction consumed ...
        uint256 gasUsed = initialGas - gasleft();

        // We refund the relayer for sending the transaction + tip.
        // The gasTip can be the amount of gas used for the initial callData call. (In theory no real tip).
        uint256 refundAmount = (gasUsed + gasTip) * gasPrice;

        // We refund the relayer ...
        success = _call(msg.sender, refundAmount, new bytes(0), gasleft());

        // If the transaction returns false, we revert ..
        if (!success) revert LW__exec__failure();
    }

    /**
     * @dev Simulates a transaction to have a rough estimate for UserOp.callGas.
     * @notice Needs to be called off-chain from the address zero.
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
    ) external returns (uint256 totalGas) {
        uint256 initialGas = gasleft();
        if (nonce++ != _nonce) revert LW__validateUserOp__invalidNonce();
        verifyTransaction(
            to,
            value,
            callData,
            _nonce,
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasTip,
            signatures
        );
        bool success = _call(to, value, callData, gasleft());
        if (!success) revert LW__exec__failure();
        uint256 gasPrice = calculateGasPrice(
            maxFeePerGas,
            maxPriorityFeePerGas
        );
        uint256 gasUsed = initialGas - gasleft();
        uint256 refundAmount = (gasUsed + gasTip) * gasPrice;
        success = _call(msg.sender, refundAmount, new bytes(0), gasleft());
        if (!success) revert LW__exec__failure();
        totalGas = initialGas - gasleft();
        require(
            msg.sender == address(0),
            "Must be called off-chain from address zero."
        );
    }

    function operationHash(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasTip
    ) public view returns (bytes32) {
        return
            keccak256(
                encodeOperation(
                    to,
                    value,
                    callData,
                    _nonce,
                    maxFeePerGas,
                    maxPriorityFeePerGas,
                    gasTip
                )
            );
    }

    /**
     * @dev Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * @param hash Hash of a message signed on behalf of address(this).
     * @param signature Signature byte array associated with _msgHash.
     * @return Magic value  or reverts with an error message.
     */
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        returns (bytes4)
    {
        bytes32 r;
        bytes32 s;
        uint8 v;
        (r, s, v) = splitSigs(signature, 0);
        address recovered = returnSigner(hash, r, s, v);
        if (recovered != owner) revert LW__isValidSignature__invalidSigner();
        else return EIP1271_MAGIC_VALUE;
    }

    /**
     * @return chainId The chain id of this.
     */
    function getChainId() public view returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }

    function domainSeparator() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    DOMAIN_SEPARATOR_TYPEHASH,
                    getChainId(),
                    address(this)
                )
            );
    }

    function verifyTransaction(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasTip,
        bytes calldata signatures
    ) internal view {
        // We encode the transaction data.
        bytes memory encodedData = encodeOperation(
            to,
            value,
            callData,
            _nonce,
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasTip
        );

        // Now we hash it ...
        bytes32 dataHash = keccak256(encodedData);

        // We get the actual function selector to determine access ...
        bytes4 funcSelector = bytes4(callData);

        // access() checks if the wallet is locked for the owner or guardians ...
        Access _access = access(funcSelector);

        // We verify that the signatures are correct depending on the transaction type ...
        verifySignatures(_access, dataHash, signatures);
    }

    /**
     * @dev Verifies that the signature(s) match the transaction type and sender.
     * @param _access Who has permission to invoke this transaction.
     * @param dataHash The keccak256 has of the transaction's data playload.
     * @param signatures The signatures sent by the UserOp.
     */
    function verifySignatures(
        Access _access,
        bytes32 dataHash,
        bytes calldata signatures
    ) internal view {
        if (_access == Access.Owner) {
            verifyOwner(dataHash, signatures);
        } else if (_access == Access.Guardian) {
            verifyGuardian(dataHash, signatures);
        } else if (_access == Access.OwnerAndGuardian) {
            verifyOwnerAndGuardian(dataHash, signatures);
        } else if (_access == Access.RecoveryOwnerAndGuardian) {
            verifyRecoveryOwnerAndGurdian(dataHash, signatures);
        } else if (_access == Access.OwnerAndRecoveryOwner) {
            verifyOwnerAndRecoveryOwner(dataHash, signatures);
        } else {
            revert();
        }
    }

    function encodeOperation(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasTip
    ) internal view returns (bytes memory) {
        bytes32 userOperationHash = keccak256(
            abi.encode(
                LASER_TYPE_STRUCTURE,
                to,
                value,
                keccak256(callData),
                _nonce,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasTip
            )
        );

        return
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                domainSeparator(),
                userOperationHash
            );
    }
}
