// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "./core/AccountAbstraction.sol";
import "./core/Singleton.sol";
import "./guardians/Guardians.sol";
import "./handlers/Handler.sol";
import "./interfaces/IEIP4337.sol";
import "./interfaces/IERC1271Wallet.sol";
import "./utils/Utils.sol";

import "hardhat/console.sol";

/**
 * @title LaserWallet - EVM based smart contract wallet. Implementes "sovereign social recovery" mechanism.
 * @author Rodrigo Herrera I.
 */
contract LaserWallet is
    Singleton,
    Guardians,
    AccountAbstraction,
    IERC1271Wallet,
    IEIP4337,
    Handler,
    Utils
{
    using UserOperationLib for UserOperation;

    string public constant VERSION = "1.0.0";

    uint256 public nonce;

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");
    bytes32 private constant LASER_OP_TYPEHASH =
        keccak256(
            "LaserOp(address sender,uint256 nonce,bytes callData,uint256 callGas,uint256 verificationGas,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,address paymaster,bytes paymasterData)"
        );
    bytes4 private constant EIP1271_MAGIC_VALUE =
        bytes4(keccak256("isValidSignature(bytes32,bytes)"));

    error LW__InvalidNonce();
    error LW__ExecutionError();
    error LW__InvalidSignature();
    error LW__InvalidSigner__NotOwner();
    error LW__OnlyGuardians();
    error LW__NotGuardianCall();
    error LW__NotGuardian();
    error LW__InvalidCallData();
    error LW__WalletLocked();
    error LW__MultiCallFailed();

    event Setup(address owner, address[] guardians, address entryPoint);
    event ApproveHash(bytes32 indexed approvedHash, address indexed owner);
    event SignMsg(bytes32 indexed msgHash);
    event ExecutionSuccess(address to, uint256 value, bytes data);
    event Received(address indexed sender, uint256 amount);

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
    }

    modifier onlyEntryPointOrOwner() {
        require(
            msg.sender == entryPoint || msg.sender == owner,
            "LW__exec__InvalidCaller"
        );
        _;
    }

    modifier onlyEntryPointOrGuardian() {
        require(
            msg.sender == entryPoint || guardians[msg.sender] != address(0),
            "LW__guardianCall__InvalidCaller"
        );
        _;
    }

    constructor() {
        // This makes the singleton unusable. e.g. (parity wallet hack).
        owner = address(this);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /**
     * @dev Setup function sets initial storage of contract.
     * @param _owner The owner of the wallet.
     * @param _guardians Addresses that can activate the social recovery mechanism.
     * @param _entryPoint Entry Point contract address.
     */
    function init(
        address _owner,
        address[] calldata _guardians,
        address _entryPoint
    ) external {
        initOwner(_owner);
        initGuardians(_guardians);
        initEntryPoint(_entryPoint);
        emit Setup(owner, _guardians, entryPoint);
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
     * @param userOp UserOperation struct that contains the transaction information.
     * @param _requiredPrefund amount to pay to EntryPoint to perform execution.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 _requiredPrefund
    ) external override onlyFromEntryPoint {
        // Increase the nonce to avoid drained funds from multiple pay prefunds.
        if (++nonce != userOp.nonce) {
            revert LW__InvalidNonce();
        }
        // We need to check that the requested prefund is in bounds.
        require(
            _requiredPrefund <= userOp.requiredPreFund(),
            "LW-AA: incorrect required prefund"
        );
        bytes memory userOpData = encodeUserOperationData(
            userOp.sender,
            userOp.nonce,
            userOp.callData,
            userOp.callGas,
            userOp.verificationGas,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            userOp.paymaster,
            userOp.paymasterData
        );
        bytes32 dataHash = keccak256(userOpData);
        address recovered = returnSigner(dataHash, userOp.signature);

        if (bytes4(userOp.callData) == this.exec.selector) {
            if (recovered != owner) {
                revert LW__InvalidSigner__NotOwner();
            }
            if (isLocked) {
                revert LW__WalletLocked();
            }
        } else if (bytes4(userOp.callData) == this.guardianCall.selector) {
            if (guardians[recovered] == address(0)) {
                revert LW__NotGuardian();
            }
        } else {
            revert LW__InvalidCallData();
        }
        payPrefund(_requiredPrefund);
    }

    /**
     * @dev Executes an AA transaction. The msg.sender needs to be the EntryPoint address.
     * The signatures are verified in validateUserOp().
     * @param to Destination address of Safe transaction.
     * @param value Ether value of Safe transaction.
     * @param callData Data payload of Safe transaction.
     */
    function exec(
        address to,
        uint256 value,
        bytes calldata callData
    ) external onlyEntryPointOrOwner isNotLocked returns (bytes memory result) {
        if (isGuardianCall(bytes4(callData))) {
            revert LW__OnlyGuardians();
        }
        bool success;
        (success, result) = to.call{value: value}(callData);
        if (!success) {
            revert LW__ExecutionError();
        }
    }

    function guardianCall(bytes calldata callData)
        external
        onlyEntryPointOrGuardian
    {
        if (!isGuardianCall(bytes4(callData))) {
            revert LW__NotGuardianCall();
        }
        (bool success, ) = address(this).call(callData);
        if (!success) {
            revert LW__ExecutionError();
        }
    }

    /**
     * @dev Executes a series of transactions.
     * @param transactions populated array of transactions.
     */
    function multiCall(Transaction[] calldata transactions)
        external
        onlyEntryPointOrOwner
    {
        for (uint256 i = 0; i < transactions.length; i++) {
            (bool success, ) = transactions[i].to.call{
                value: transactions[i].value
            }(transactions[i].data);
        }
        if (!success) {
            revert LW__MultiCallFailed();
        }
    }

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
     */
    function encodeUserOperationData(
        address _sender,
        uint256 _nonce,
        bytes calldata _callData,
        uint256 _callGas,
        uint256 _verificationGas,
        uint256 _preVerificationGas,
        uint256 _maxFeePerGas,
        uint256 _maxPriorityFeePerGas,
        address _paymaster,
        bytes calldata _payMasterData
    ) internal view returns (bytes memory) {
        bytes32 _userOperationHash = keccak256(
            abi.encode(
                LASER_OP_TYPEHASH,
                _sender,
                _nonce,
                keccak256(_callData),
                _callGas,
                _verificationGas,
                _preVerificationGas,
                _maxFeePerGas,
                _maxPriorityFeePerGas,
                _paymaster,
                keccak256(_payMasterData)
            )
        );
        return
            abi.encodePacked(
                bytes1(0x19),
                bytes1(0x01),
                domainSeparator(),
                _userOperationHash
            );
    }

    /**
     * @dev Returns the user operation hash to be signed by owners.
     * @param _userOp The UserOperation struct.
     */
    function userOperationHash(UserOperation calldata _userOp)
        public
        view
        returns (bytes32)
    {
        return
            keccak256(
                encodeUserOperationData(
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
                )
            );
    }

    /**
     * @notice Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * @param hash Hash of a message signed on behalf of address(this).
     * @param signature Signature byte array associated with _msgHash.
     * @return Magic value  or reverts with an error message.
     */
    function isValidSignature(bytes32 hash, bytes memory signature)
        public
        view
        returns (bytes4)
    {
        address recovered = returnSigner(hash, signature);
        if (recovered != owner) revert LW__InvalidSignature();
        return EIP1271_MAGIC_VALUE;
    }
}
