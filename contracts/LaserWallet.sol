// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "./base/OwnerManager.sol";
import "./common/AccountAbstraction.sol";
import "./common/EtherPaymentFallback.sol";
import "./common/SignatureDecoder.sol";
import "./common/Singleton.sol";
import "./external/SafeMath.sol";
import "./handlers/Handler.sol";
import "./interfaces/IEIP4337.sol";
import "./interfaces/IERC1271Wallet.sol";
import "./libraries/ECDSA.sol";
import "./modules/Guard.sol";

/**
 * @title LaserWallet - Multi - Signature smart contract wallet for the EVM.
 * @author Rodrigo Herrera I. Modified from Gnosis Safe: https://github.com/gnosis/safe-contracts/tree/main/contracts
 */
// TODO: Eliminate the ecrecover2 (no longer needed in the eip).
contract LaserWallet is
    EtherPaymentFallback,
    Singleton,
    AccountAbstraction,
    OwnerManager,
    Guard,
    SignatureDecoder,
    IERC1271Wallet,
    IEIP4337,
    Handler
{
    using SafeMath for uint256;
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    string public constant VERSION = "1.0.0";

    uint256 public nonce;

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant SAFE_TX_TYPEHASH =
        keccak256("SafeTx(address to,uint256 value,bytes data,uint256 nonce)");

    bytes4 private constant EIP1271_MAGIC_VALUE =
        bytes4(keccak256("isValidSignature(bytes32,bytes)"));

    event SafeSetup(
        address[] owners,
        address[] specialOwners,
        uint256 threshold,
        address entryPoint,
        uint256 ethSpendingLimit
    );
    event ApproveHash(bytes32 indexed approvedHash, address indexed owner);
    event SignMsg(bytes32 indexed msgHash);
    event ExecutionSuccess(address to, uint256 value, bytes data);

    // This constructor ensures that this contract can only be used as a master copy for Proxy contracts
    constructor() {
        // By setting the threshold it is not possible to call setup anymore,
        // so we create a Safe with 0 owners and threshold 1.
        // This is an unusable Safe, perfect for the singleton.
        threshold = 1;
    }

    /**
     * @dev Setup function sets initial storage of contract.
     * @param _owners Array of owners.
     * @param _specialOwners Array of special owners. Special owners can authorize a transaction with only 1 signature.
     * @param _threshold Number of required confirmations to execute a transaction. * with the exception of a special owner.
     * @param _entryPoint Entry Point contract address.
     * @param _ethSpendingLimit Optional Eth spending limit per transaction.
     */
    function setup(
        address[] calldata _owners,
        address[] calldata _specialOwners,
        uint256 _threshold,
        address _entryPoint,
        uint256 _ethSpendingLimit
    ) external {
        setupOwners(_owners, _specialOwners, _threshold);
        if (_ethSpendingLimit > 0) {
            initGuard(_ethSpendingLimit);
        }
        require(
            _entryPoint != address(this) && _entryPoint.code.length > 0,
            "LW: Invalid Entry Point address"
        );
        entryPoint = _entryPoint;
        emit SafeSetup(
            _owners,
            _specialOwners,
            _threshold,
            _entryPoint,
            _ethSpendingLimit
        );
    }

    /**
     * @dev Pays the required amount to the EntryPoint contract.
     * @param _requiredPrefund amount to pay to EntryPoint to perform execution.
     */
    function payPrefund(uint256 _requiredPrefund) internal {
        if (_requiredPrefund > 0) {
            (bool success, ) = payable(msg.sender).call{
                value: _requiredPrefund,
                gas: type(uint256).max
            }("");
            // It is EntryPoint's job to check for success.
            (success);
        }
    }

    /**
     * @dev Validates that the exeuction from EntryPoint is correct.
     * EIP: https://eips.ethereum.org/EIPS/eip-4337
     * @param _userOp UserOperation struct that contains the transaction information.
     * @param _requiredPrefund amount to pay to EntryPoint to perform execution.
     */
    function validateUserOp(
        UserOperation calldata _userOp,
        bytes32,
        uint256 _requiredPrefund
    ) external override onlyFromEntryPoint {
        // Increase the nonce to avoid drained funds from multiple pay prefunds.
        require(nonce++ == _userOp.nonce, "LW-AA: invalid nonce");
        // We need to check that the requested prefund is in bounds.
        require(
            _requiredPrefund <= _userOp.requiredPreFund(),
            "LW-AA: incorrect required prefund"
        );
        // We check that the first 4 bytes of the calldata corresponds to the function selector.
        // This is primarily done to avoid incorrect transactions and pay unecessary prefunds.
        // 0x80c5c7d0  =>  bytes4(keccak256(execFromEntryPoint(address,uint256,bytes)))
        require(
            bytes4(_userOp.callData) == 0x80c5c7d0,
            "LW-AA: incorrect callData"
        );
        bytes memory userOpTxData = encodeUserOperationData(
            _userOp.sender,
            _userOp.nonce,
            _userOp.callData,
            _userOp.callGas,
            _userOp.verificationGas,
            _userOp.preVerificationGas,
            _userOp.maxFeePerGas,
            _userOp.maxPriorityFeePerGas,
            _userOp.paymaster,
            _userOp.paymasterData
        );
        bytes32 userOpTxHash = keccak256(userOpTxData);
        checkSignatures(userOpTxHash, _userOp.signature);
        if (ethSpendingLimit > 0) {
            (, uint256 value, ) = abi.decode(
                _userOp.callData[4:],
                (address, uint256, bytes)
            );
            if (value > 0) {
                guard(value);
            }
        }
        payPrefund(_requiredPrefund);
    }

    /**
     * @dev Allows to execute a Safe transaction confirmed by required number of owners and then pays the account that submitted the transaction.
     * Note: The fees are always transferred, even if the user transaction fails.
     * @param _to Destination address of Safe transaction.
     * @param _value Ether value of Safe transaction.
     * @param _data Data payload of Safe transaction.
     * @param _signatures Packed signature data ({bytes32 r}{bytes32 s}{uint8 v}).
     * signing the transaction, address(0) must be provided.
     */
    function execTransaction(
        address _to,
        uint256 _value,
        bytes memory _data,
        bytes memory _signatures
    ) public payable returns (bool success) {
        bytes memory txHashData = encodeTransactionData(
            _to,
            _value,
            _data,
            nonce++ // We immediately increase the nonce to avoid replay attacks.
        );
        bytes32 txHash = keccak256(txHashData);
        checkSignatures(txHash, _signatures);
        if (_value > 0 && ethSpendingLimit > 0) {
            guard(_value);
        }
        (success, ) = _to.call{value: _value}(_data);
        require(success, "ET: Execution error");
        // handlePostOp();
        emit ExecutionSuccess(_to, _value, _data);
    }

    /**
     * @dev Executes an AA transaction. The msg.sender needs to be the EntryPoint address.
     * The signatures are verified in validateUserOp().
     * @param _to Destination address of Safe transaction.
     * @param _value Ether value of Safe transaction.
     * @param _data Data payload of Safe transaction.
     */
    function execFromEntryPoint(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public onlyFromEntryPoint returns (bool success) {
        (success, ) = _to.call{value: _value}(_data);
        require(success, "LW-EP: Execution Error");
        emit ExecutionSuccess(_to, _value, _data);
    }

    /**
     * @dev Checks whether the signature provided is valid for the provided data, hash. Will revert otherwise.
     * @param _dataHash Hash of the data (could be either a message hash or transaction hash)
     * @param _signatures Signature data that should be verified. Can be ECDSA signature, contract signature (EIP-1271) or approved hash.
     */
    function checkSignatures(bytes32 _dataHash, bytes memory _signatures)
        public
        view
    {
        // We retrieve the first 65 bytes of the signature to check if the signer is a Special Owner.
        address currentOwner = getFirstSigner(_dataHash, _signatures);
        uint256 _threshold = specialOwners[currentOwner] ? 1 : threshold;
        require(_threshold > 0, "LW: Threshold cannot be 0");
        // If threshold is 1, we just need to check that that the signer is an approved owner.
        if (_threshold == 1) {
            require(
                owners[currentOwner] != address(0) &&
                    currentOwner != SENTINEL_OWNERS,
                "LW: Invalid owner provided"
            );
        } else {
            checkNSignatures(_dataHash, _signatures, _threshold);
        }
    }

    /**
     * @dev Checks whether the signature provided is valid for the provided data, hash. Will revert otherwise.
     * @param _dataHash Hash of the data (could be either a message hash or transaction hash)
     * @param _signatures Signature data that should be verified. Can be ECDSA signature, contract signature (EIP-1271) or approved hash.
     * @param _requiredSignatures Amount of required valid signatures.
     */
    function checkNSignatures(
        bytes32 _dataHash,
        bytes memory _signatures,
        uint256 _requiredSignatures
    ) public view {
        // Check that the provided signature data is not too short
        require(
            _signatures.length >= _requiredSignatures * 65,
            "LW: Incorrect signature length || Incorrect Special Owner signature"
        );
        // There cannot be an owner with address 0.
        address lastOwner = address(0);
        address currentOwner;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 i;
        for (i = 0; i < _requiredSignatures; i++) {
            (v, r, s) = signatureSplit(_signatures, i);
            if (v > 30) {
                // If v > 30 then default va (27,28) has been adjusted for eth_sign flow
                // To support eth_sign and similar we adjust v and hash the messageHash with the Ethereum message prefix before applying ecrecover
                currentOwner = keccak256(
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n32",
                        _dataHash
                    )
                ).recover(v - 4, r, s);
            } else {
                // We cannot use ecrecover due to the prohibition of the GAS opcode in the EIP4337.
                currentOwner = _dataHash.recover(v, r, s);
            }
            require(
                currentOwner > lastOwner &&
                    owners[currentOwner] != address(0) &&
                    currentOwner != SENTINEL_OWNERS,
                "LW: Invalid owner provided"
            );
            lastOwner = currentOwner;
        }
    }

    /**
     * @dev Returns the chain id used by this contract.
     */
    function getChainId() public view returns (uint256) {
        return block.chainid;
    }

    function domainSeparator() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    DOMAIN_SEPARATOR_TYPEHASH,
                    block.chainid,
                    address(this)
                )
            );
    }

    /**
     * @dev Returns the bytes that are hashed to be signed by owners.
     * @param _to Destination address.
     * @param _value Ether value.
     * @param _data Data payload.
     * @param _nonce Transaction nonce.
     * @return Transaction hash bytes.
     */
    function encodeTransactionData(
        address _to,
        uint256 _value,
        bytes memory _data,
        uint256 _nonce
    ) public view returns (bytes memory) {
        bytes32 safeTxHash = keccak256(
            abi.encode(SAFE_TX_TYPEHASH, _to, _value, keccak256(_data), _nonce)
        );
        return
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                domainSeparator(),
                safeTxHash
            );
    }

    /**
     * @dev Returns hash to be signed by owners.
     * @param _to Destination address.
     * @param _value Ether value.
     * @param _data Data payload.
     * @param _nonce Transaction nonce.
     * @return Transaction hash.
     */
    function getTransactionHash(
        address _to,
        uint256 _value,
        bytes calldata _data,
        uint256 _nonce
    ) public view returns (bytes32) {
        return keccak256(encodeTransactionData(_to, _value, _data, _nonce));
    }

    /**
     * @notice Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * @param _hash Hash of a message signed on behalf of address(this).
     * @param _signatures Signature byte array associated with _msgHash.
     * @return Magic value  or reverts with an error message.
     */
    function isValidSignature(bytes32 _hash, bytes memory _signatures)
        public
        view
        returns (bytes4)
    {
        checkSignatures(_hash, _signatures);
        return EIP1271_MAGIC_VALUE;
    }
}
