// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "./common/EtherPaymentFallback.sol";
import "./common/Singleton.sol";
import "./common/EntryPoint.sol";
import "./base/OwnerManager.sol";
import "./common/SignatureDecoder.sol";
import "./common/SecuredTokenTransfer.sol";
import "./interfaces/IERC1271Wallet.sol";
import "./common/Enum.sol";
import "./base/Executor.sol";
import "./interfaces/IEIP4337.sol";
import "./external/SafeMath.sol";
import "./libraries/ECDSA.sol";

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/*
 *               * *    ****   ******** * * * *         *              * *   *         *           ******************
 *              *   *  *       *        *       *        *            *   *  *         *            *         *
 *             *******   ***   *****    *       *         *    *     ******* *         *            *****     *
 *            *       *      * *        *  *  *            *  *  *  *      * *         *            *         *
 * ***********         * ****  ******** *       *            *     *        *  ******************** ********  *
 */

/**
 * @title LaserWallet- Multi-sig (modular) wallet that implements EIP4337 (account-abstraction).
 * @author Rodrigo Herrera I. FORK FROM GNOSIS SAFE + Additional Features: https://github.com/gnosis/safe-contracts/tree/main/contracts
 */
contract LaserWallet is
    EtherPaymentFallback,
    Singleton,
    EntryPoint,
    OwnerManager,
    SignatureDecoder,
    SecuredTokenTransfer,
    IERC1271Wallet,
    Enum,
    Executor,
    IEIP4337,
    ERC1155Holder,
    ERC721Holder
{
    using SafeMath for uint256;
    using ECDSA for bytes32;

    string public constant VERSION = "1.0.0";

    uint256 public nonce;

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;
    // keccak256(
    //     "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
    // );
    bytes32 private constant SAFE_TX_TYPEHASH =
        0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;
    // Magic value to return for valid contract signatures.
    // bytes4(keccak256(isValidSignature(bytes32,bytes))
    bytes4 private constant EIP1271_MAGIC_VALUE = 0x1626ba7e;

    event SafeSetup(
        address indexed initiator,
        address[] owners,
        address[] specialOwners,
        uint256 threshold,
        address entryPoint
    );
    event ApproveHash(bytes32 indexed approvedHash, address indexed owner);
    event SignMsg(bytes32 indexed msgHash);
    event ExecutionFailure(bytes32 txHash, uint256 payment);
    event ExecutionSuccess(bytes32 txHash, uint256 payment);

    // Mapping to keep track of all hashes (message or transaction) that have been approved by ANY owners
    mapping(address => mapping(bytes32 => uint256)) public approvedHashes;

    // This constructor ensures that this contract can only be used as a master copy for Proxy contracts
    constructor() {
        // By setting the threshold it is not possible to call setup anymore,
        // so we create a Safe with 0 owners and threshold 1.
        // This is an unusable Safe, perfect for the singleton
        threshold = 1;
    }

    /**
     * @dev Setup function sets initial storage of contract.
     * @param _owners List of Safe owners.
     * @param _threshold Number of required confirmations for a Safe transaction.
     */
    function setup(
        address[] calldata _owners,
        address[] calldata _specialOwners,
        uint256 _threshold,
        address _entryPoint
    ) external {
        // setupOwners checks if the Threshold is already set, therefore preventing that this method is called twice.
        setupOwners(_owners, _specialOwners, _threshold);
        require(entryPoint == address(0), "Wallet already initialized");
        require(
            _entryPoint != address(0) && _entryPoint != address(this),
            "Incorrect entry point address"
        );
        entryPoint = _entryPoint;
        emit SafeSetup(
            msg.sender,
            _owners,
            _specialOwners,
            _threshold,
            entryPoint
        );
    }

    /**
     * @dev pays the required amount to the EntryPoint contract.
     * @param _requiredPrefund amount to pay to EntryPoint to perform execution.
     */
    function payPrefund(uint256 _requiredPrefund) internal {
        if (_requiredPrefund > 0) {
            (bool success, ) = payable(msg.sender).call{
                value: _requiredPrefund,
                gas: type(uint256).max
            }("");
            (success);
        }
    }

    /**
     * @dev Validates that the exeuction from EntryPoint is correct.
     * EIP: https://eips.ethereum.org/EIPS/eip-4337
     * @param userOp UserOperation struct that contains the transaction information.
     * @param _requestId the hash of the transaction, although it is irrelevant for our use.
     * @param _requiredPrefund amount to pay to EntryPoint to perform execution.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 _requestId,
        uint256 _requiredPrefund
    ) external override onlyFromEntryPoint {
        // to silence compiler warning
        _requestId;
        (
            address to,
            uint256 value,
            bytes memory data,
            uint8 _operation,
            uint256 safeTxGas,
            uint256 baseGas,
            uint256 gasPrice,
            address gasToken,
            address refundReceiver,
            bytes memory signatures,
            address specialOwner
        ) = abi.decode(
                userOp.callData[4:],
                (
                    address,
                    uint256,
                    bytes,
                    uint8,
                    uint256,
                    uint256,
                    uint256,
                    address,
                    address,
                    bytes,
                    address
                )
            );
        Enum.Operation operation = _operation == 0
            ? Enum.Operation.Call
            : Enum.Operation.DelegateCall;
        bytes memory txHashData = encodeTransactionData(
            to,
            value,
            data,
            operation,
            safeTxGas,
            baseGas,
            gasPrice,
            gasToken,
            refundReceiver,
            nonce
        );
        nonce++;
        bytes32 txHash = keccak256(txHashData);
        checkSignatures(txHash, signatures, specialOwner);
        payPrefund(_requiredPrefund);
    }

    /**
     * @dev Allows to execute a Safe transaction confirmed by required number of owners and then pays the account that submitted the transaction.
     * Note: The fees are always transferred, even if the user transaction fails.
     * @param to Destination address of Safe transaction.
     * @param value Ether value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param safeTxGas Gas that should be used for the Safe transaction.
     * @param baseGas Gas costs that are independent of the transaction execution(e.g. base transaction fee, signature check, payment of the refund)
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 if ETH) that is used for the payment.
     * @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
     * @param signatures Packed signature data ({bytes32 r}{bytes32 s}{uint8 v}).
     * @param specialOwner Owner that has special transaction priviliges. If the special owner is not
     * signing the transaction, address(0) must be provided.
     */
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address specialOwner
    ) public payable virtual returns (bool success) {
        bytes32 txHash;
        // Use scope here to limit variable lifetime and prevent `stack too deep` errors
        {
            // If msg.sender is entry point, we can skip the verification process because it was already
            // done in validateUserOp.
            if (msg.sender != entryPoint) {
                bytes memory txHashData = encodeTransactionData(
                    // Transaction info
                    to,
                    value,
                    data,
                    operation,
                    safeTxGas,
                    // Payment info
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver,
                    // Signature info
                    nonce
                );
                // Increase nonce and execute transaction
                nonce++;
                txHash = keccak256(txHashData);
                checkSignatures(txHash, signatures, specialOwner);
            }
        }
        // We require some gas to emit the events (at least 2500) after the execution and some to perform code until the execution (500)
        // We also include the 1/64 in the check that is not send along with a call to counteract potential shortings because of EIP-150
        require(
            gasleft() >= ((safeTxGas * 64) / 63).max(safeTxGas + 2500) + 500,
            "Not enough gas to execute the transaction"
        );
        {
            uint256 gasUsed = gasleft();
            // If the gasPrice is 0 we assume that nearly all available gas can be used (it is always more than safeTxGas)
            // We only substract 2500 (compared to the 3000 before) to ensure that the amount passed is still higher than safeTxGas
            success = execute(
                to,
                value,
                data,
                operation,
                gasPrice == 0 ? (gasleft() - 2500) : safeTxGas
            );
            gasUsed = gasUsed - gasleft();
            // If no safeTxGas and no gasPrice was set (e.g. both are 0), then the internal tx is required to be successful
            // This makes it possible to use `estimateGas` without issues, as it searches for the minimum gas where the tx doesn't revert
            require(
                success || safeTxGas != 0 || gasPrice != 0,
                "Execution error"
            );
            // We transfer the calculated tx costs to the tx.origin to avoid sending it to intermediate contracts that have made calls
            uint256 payment = 0;
            if (gasPrice > 0) {
                payment = handlePayment(
                    gasUsed,
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver
                );
            }
            if (success) emit ExecutionSuccess(txHash, payment);
            else emit ExecutionFailure(txHash, payment);
        }
    }

    function handlePayment(
        uint256 gasUsed,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver
    ) private returns (uint256 payment) {
        // solhint-disable-next-line avoid-tx-origin
        address payable receiver = refundReceiver == address(0)
            ? payable(tx.origin)
            : refundReceiver;
        if (gasToken == address(0)) {
            // For ETH we will only adjust the gas price to not be higher than the actual used gas price
            payment =
                (gasUsed + baseGas) *
                (gasPrice < tx.gasprice ? gasPrice : tx.gasprice);
            require(
                receiver.send(payment),
                "Could not pay gas costs with ether"
            );
        } else {
            payment = (gasUsed + baseGas) * gasPrice;
            require(
                transferToken(gasToken, receiver, payment),
                "Could not pay gas costs with token"
            );
        }
    }

    /**
     * @dev Checks whether the signature provided is valid for the provided data, hash. Will revert otherwise.
     * @param dataHash Hash of the data (could be either a message hash or transaction hash)
     * @param signatures Signature data that should be verified. Can be ECDSA signature, contract signature (EIP-1271) or approved hash.
     */
    function checkSignatures(
        bytes32 dataHash,
        bytes memory signatures,
        address specialOwner
    ) public view {
        // Load threshold to avoid multiple storage loads.
        // If a special owner is authorizing this transaction, then threshold is 1.
        uint256 _threshold = specialOwner != address(0) ? 1 : threshold;
        // Check that a threshold is set
        require(_threshold > 0, "Threshold cannot be 0");
        checkNSignatures(dataHash, signatures, _threshold, specialOwner);
    }

    /**
     * @dev Checks whether the signature provided is valid for the provided data, hash. Will revert otherwise.
     * @param dataHash Hash of the data (could be either a message hash or transaction hash)
     * @param signatures Signature data that should be verified. Can be ECDSA signature, contract signature (EIP-1271) or approved hash.
     * @param requiredSignatures Amount of required valid signatures.
     */
    function checkNSignatures(
        bytes32 dataHash,
        bytes memory signatures,
        uint256 requiredSignatures,
        address specialOwner
    ) public view {
        // Check that the provided signature data is not too short
        require(
            signatures.length >= requiredSignatures * 65,
            "Incorrect signature length"
        );
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 i;
        for (i = 0; i < requiredSignatures; i++) {
            (v, r, s) = signatureSplit(signatures, i);
            if (v == 0) {
                // If v is 0 then it is a contract signature
                // When handling contract signatures the address of the contract is encoded into r
                currentOwner = address(uint160(uint256(r)));

                // Check that signature data pointer (s) is not pointing inside the static part of the signatures bytes
                // This check is not completely accurate, since it is possible that more signatures than the threshold are send.
                // Here we only check that the pointer is not pointing inside the part that is being processed
                require(
                    uint256(s) >= requiredSignatures * 65,
                    "Signature error: data pointer (s)"
                );

                // Check that signature data pointer (s) is in bounds (points to the length of data -> 32 bytes)
                require(
                    uint256(s) + 32 <= signatures.length,
                    "Signature error: data pointer (s)"
                );

                // Check if the contract signature is in bounds: start of data is s + 32 and end is start + signature length
                uint256 contractSignatureLen;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    contractSignatureLen := mload(add(add(signatures, s), 0x20))
                }
                require(
                    uint256(s) + 32 + contractSignatureLen <= signatures.length,
                    "Incorrect signature length"
                );

                // Check signature
                bytes memory contractSignature;
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    // The signature data for contract signatures is appended to the concatenated signatures and the offset is stored in s
                    contractSignature := add(add(signatures, s), 0x20)
                }
                require(
                    IERC1271Wallet(currentOwner).isValidSignature(
                        dataHash,
                        contractSignature
                    ) == EIP1271_MAGIC_VALUE,
                    "Incorrect EIP1271 MAGIC VALUE"
                );
            } else if (v == 1) {
                // If v is 1 then it is an approved hash
                // When handling approved hashes the address of the approver is encoded into r
                currentOwner = address(uint160(uint256(r)));
                // Hashes are automatically approved by the sender of the message or when they have been pre-approved via a separate transaction
                require(
                    msg.sender == currentOwner ||
                        approvedHashes[currentOwner][dataHash] != 0,
                    "Incorrect owner and/or hash not approved"
                );
            } else if (v > 30) {
                // If v > 30 then default va (27,28) has been adjusted for eth_sign flow
                // To support eth_sign and similar we adjust v and hash the messageHash with the Ethereum message prefix before applying ecrecover

                currentOwner =
                   keccak256(
                        abi.encodePacked(
                            "\x19Ethereum Signed Message:\n32",
                            dataHash
                )).recover(v -4, r, s);

                currentOwner = keccak256( //hash.recover(v, r, s)
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n32",
                        dataHash
                    )
                ).recover(v - 4, r, s);

            } else {
                // We cannot use ecrecover due to the prohibition of the GAS opcode in the EIP4337.
                currentOwner = dataHash.recover(v, r, s);
            }
            if (specialOwner != address(0)) {
                require(
                    currentOwner == specialOwner && specialOwners[specialOwner],
                    "Incorrect special owner"
                );
            } else {
                require(
                    currentOwner > lastOwner &&
                        owners[currentOwner] != address(0) &&
                        currentOwner != SENTINEL_OWNERS,
                    "Invalid owner provided"
                );
            }
            lastOwner = currentOwner;
        }
    }

    /**
     * @dev Marks a hash as approved. This can be used to validate a hash that is used by a signature.
     * @param hashToApprove The hash that should be marked as approved for signatures that are verified by this contract.
     */
    function approveHash(bytes32 hashToApprove) external {
        require(
            owners[msg.sender] != address(0),
            "Only owners can approve a hash"
        );
        approvedHashes[msg.sender][hashToApprove] = 1;
        emit ApproveHash(hashToApprove, msg.sender);
    }

    /**
     * @dev Returns the chain id used by this contract.
     */
    function getChainId() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
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

    /**
     * @dev Returns the bytes that are hashed to be signed by owners.
     * @param to Destination address.
     * @param value Ether value.
     * @param data Data payload.
     * @param operation Operation type.
     * @param safeTxGas Gas that should be used for the safe transaction.
     * @param baseGas Gas costs for that are independent of the transaction execution(e.g. base transaction fee, signature check, payment of the refund)
     * @param gasPrice Maximum gas price that should be used for this transaction.
     * @param gasToken Token address (or 0 if ETH) that is used for the payment.
     * @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
     * @param _nonce Transaction nonce.
     * @return Transaction hash bytes.
     */
    function encodeTransactionData(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) public view returns (bytes memory) {
        bytes32 safeTxHash = keccak256(
            abi.encode(
                SAFE_TX_TYPEHASH,
                to,
                value,
                keccak256(data),
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                _nonce
            )
        );
        return
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                domainSeparator(),
                safeTxHash
            );
    }

    /// @dev Returns hash to be signed by owners.
    /// @param to Destination address.
    /// @param value Ether value.
    /// @param data Data payload.
    /// @param operation Operation type.
    /// @param safeTxGas Fas that should be used for the safe transaction.
    /// @param baseGas Gas costs for data used to trigger the safe transaction.
    /// @param gasPrice Maximum gas price that should be used for this transaction.
    /// @param gasToken Token address (or 0 if ETH) that is used for the payment.
    /// @param refundReceiver Address of receiver of gas payment (or 0 if tx.origin).
    /// @param _nonce Transaction nonce.
    /// @return Transaction hash.
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) public view returns (bytes32) {
        return
            keccak256(
                encodeTransactionData(
                    to,
                    value,
                    data,
                    operation,
                    safeTxGas,
                    baseGas,
                    gasPrice,
                    gasToken,
                    refundReceiver,
                    _nonce
                )
            );
    }

    /**
     * @notice Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * @param _hash Hash of a message signed on the behalf of address(this).
     * @param _signature Signature byte array associated with _msgHash.
     * @return Magic value or reverts.
     */
    function isValidSignature(bytes32 _hash, bytes memory _signature)
        external
        view
        returns (bytes4)
    {
        address currentOwner;
        uint8 v;
        bytes32 r;
        bytes32 s;
        require(
            _signature.length >= 65,
            "Laser Wallet ERROR: INVALID 'isValidSignature(..)'"
        );
        // we need to do the process again manually to check if the signer is a special owner.
        if (_signature.length == 65) {
            // if signature.length is 65, the signer needs to be a special owner or the threshold is 1.
            (v, r, s) = signatureSplit(_signature, 0);
            if (v == 1) {
                currentOwner = address(uint160(uint256(r)));
                require(
                    msg.sender == currentOwner ||
                        approvedHashes[currentOwner][_hash] != 0,
                    "Laser Wallet ERROR: INVALID 'isValidSignature(..)'"
                );
            } else if (v > 30) {
                currentOwner = keccak256(
                    abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
                ).recover(v - 4, r, s);
            } else {
                currentOwner = _hash.recover(v, r, s);
                require(
                    owners[currentOwner] != address(0) &&
                        currentOwner != SENTINEL_OWNERS,
                    "Laser Wallet ERROR: INVALID 'isValidSignature(..)'"
                );
                require(
                    specialOwners[currentOwner] || threshold == 1,
                    "Laser Wallet ERROR: INVALID 'isValidSignature(..)'"
                );
            }
        } else {
            checkSignatures(_hash, _signature, address(0));
        }
        // If everything passed, we can return the magic value
        return EIP1271_MAGIC_VALUE;
    }
    
    function isLaser() external view returns (bytes4 result) {
        result = bytes4(keccak256("I_AM_LASER"));
     }
}
