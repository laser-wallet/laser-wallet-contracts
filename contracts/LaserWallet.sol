// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

import "./core/AccountAbstraction.sol";
import "./core/Singleton.sol";
import "./handlers/Handler.sol";
import "./interfaces/ILaserWallet.sol";
import "./libraries/UserOperation.sol";
import "./utils/Utils.sol";
import "./ssr/SSR.sol";

/**
 * @title LaserWallet - EVM based smart contract wallet. Implementes "sovereign social recovery" mechanism and account abstraction.
 * @author Rodrigo Herrera I.
 */
contract LaserWallet is
    Singleton,
    AccountAbstraction,
    SSR,
    Handler,
    Utils,
    ILaserWallet
{
    string public constant VERSION = "1.0.0";

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");
    bytes32 private constant LASER_OP_TYPEHASH =
        keccak256(
            "LaserOp(address sender,uint256 nonce,bytes callData,uint256 callGas,uint256 verificationGas,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,address paymaster,bytes paymasterData)"
        );
    bytes4 private constant EIP1271_MAGIC_VALUE =
        bytes4(keccak256("isValidSignature(bytes32,bytes)"));

    uint256 public nonce;

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert LW__notEntryPoint();
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
     * @dev Setup function, sets initial storage of contract.
     * @param _owner The owner of the wallet.
     * @param _recoveryOwner Recovery owner in case the owner looses the main device. Implementation of Sovereign Social Recovery.
     * @param _guardians Addresses that can activate the social recovery mechanism.
     * @param _entryPoint Entry Point contract address.
     * @notice It can't be called after initialization.
     */
    function init(
        address _owner,
        address _recoveryOwner,
        address[] calldata _guardians,
        address _entryPoint
    ) external {
        // initOwner() requires that the current owner is address 0.
        // This is enough to protect init() from being called after initialization.
        initOwners(_owner, _recoveryOwner);
        initGuardians(_guardians);
        initEntryPoint(_entryPoint);
        emit Setup(owner, _guardians, entryPoint);
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
    ) external onlyEntryPoint {
        // Increase the nonce to avoid drained funds from multiple pay prefunds.
        if (nonce++ != userOp.nonce) revert LW__validateUserOp__invalidNonce();
        // In order to check the signatures correctly, we encode the transaction data...
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
        // Now we hash it ...
        bytes32 dataHash = keccak256(userOpData);
        // We recover the sender ...
        address recovered = returnSigner(dataHash, userOp.signature);
        // We get the function selector to check proper access ...
        bytes4 funcSelector = bytes4(userOp.callData);
        if (
            // The owner can only call exec() or multiCall()
            funcSelector == this.exec.selector ||
            funcSelector == this.multiCall.selector
        ) {
            // We check that the sender is the owner ...
            if (recovered != owner) revert LW__validateUserOp__notOwner();
            // If the wallet is locked, we revert ...
            if (isLocked) revert LW__validateUserOp__walletLocked();
            // Guardians can only call the guardianCall() func ...
        } else if (funcSelector == this.guardianCall.selector) {
            // We check that the sender is a guardian ...
            if (guardians[recovered] == address(0))
                revert LW__validateUserOp__notGuardian();
            // Else, the call is invalid ...
        } else revert LW__validateUserOp__invalidFuncSelector();

        // Finally... we can pay the costs to the EntryPoint ...
        payPrefund(_requiredPrefund);
    }

    /**
     * @dev Executes an AA transaction. The msg.sender needs to be the EntryPoint address.
     * The signatures are verified in validateUserOp().
     * @param to Destination address of the transaction.
     * @param value Ether value of the transaction.
     * @param data Data payload of the transaction.
     */
    function exec(
        address to,
        uint256 value,
        bytes memory data
    ) external onlyEntryPoint {
        // We check that the the owner has proper access ...
        if (access(bytes4(data)) != Access.Owner)
            revert LW__exec__ownerNotAllowed();

        bool success = execute(to, value, data, gasleft());

        if (success) emit Success(to, value);
        else revert LW__exec__failure();
    }

    /**
     * @dev Starts the SSR mechanism. Can only be called by a guardian.
     * @param data Data payload for this transaction. It is limited to guardian access.
     */
    function guardianCall(bytes memory data) external onlyEntryPoint {
        bytes4 funcSelector = bytes4(data);
        // We check that the guardian has proper access ...
        if (access(funcSelector) != Access.Guardian)
            revert LW__guardianCall__guardianNotAllowed();

        bool success = execute(address(this), 0, data, gasleft());
        if (success) emit GuardianSuccess(funcSelector);
        else revert LW__guardianCall__failure();
    }

    /**
     * @dev Executes a series of transactions.
     * @param transactions populated array of transactions.
     * @notice If any transaction fails, the whole multiCall reverts.
     */
    function multiCall(Transaction[] calldata transactions)
        external
        onlyEntryPoint
    {
        uint256 transactionsLength = transactions.length;
        for (uint256 i = 0; i < transactionsLength; ) {
            address to = transactions[i].to;
            uint256 value = transactions[i].value;
            bytes memory data = transactions[i].data;
            bytes4 funcSelector = bytes4(data);
            // We check that the the owner has proper access ...
            if (access(funcSelector) != Access.Owner)
                revert LW__multiCall__ownerNotAllowed();

            bool success = execute(to, value, data, gasleft());
            if (!success) revert LW__multiCall__failure();

            unchecked {
                // Won't overflow...
                ++i;
            }
        }
        emit MultiCallSuccess();
    }

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
    ) external {
        bytes4 funcSelector = bytes4(data);
        ++nonce;
        bool success;
        // If the sender is the owner ...
        if (msg.sender == owner) {
            // We check that the the owner has proper access ...
            if (access(funcSelector) != Access.Owner)
                revert LW__emergencyCall__ownerNotAllowed();
            success = execute(to, value, data, gasleft());
            // If the sender is a guardian ...
        } else if (guardians[msg.sender] != address(0)) {
            if (access(funcSelector) != Access.Guardian)
                revert LW__emergencyCall__guardianNotAllowed();
            else success = execute(to, value, data, gasleft());
            // If the sender is neither the owner nor the guardian, we revert ...
        } else revert LW__emergencyCall__invalidCaller();

        if (success) emit Success(to, value);
        else revert LW__emergencyCall__failure();
    }

    /**
     * @dev Returns the user operation hash to be signed by owners.
     * @param userOp The UserOperation struct.
     */
    function userOperationHash(UserOperation calldata userOp)
        external
        view
        returns (bytes32)
    {
        return
            keccak256(
                encodeUserOperationData(
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
        address recovered = returnSigner(hash, signature);
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

    /**
     * @dev Pays the required amount to the EntryPoint contract.
     * @param requiredPrefund amount to pay to EntryPoint to perform execution.
     */
    function payPrefund(uint256 requiredPrefund) internal {
        if (requiredPrefund > 0) {
            // If we need to pay back to EntryPoint ...
            // The only possible caller of this function is EntryPoint.
            bool success = execute(
                payable(msg.sender),
                requiredPrefund,
                new bytes(0),
                gasleft()
            );
            // It is EntryPoint's job to check for success.
            (success);
        }
    }

    /**
     * @dev Returns the bytes that are hashed to be signed by owners.
     * @param sender The wallet making the operation (should be address(this)).
     * @param _nonce Anti-replay parameter; also used as the salt for first-time wallet creation.
     * @param callData The data to pass to the sender during the main execution call.
     * @param callGas The amount of gas to allocate the main execution call.
     * @param verificationGas The amount of gas to allocate for the verification step.
     * @param preVerificationGas The amount of gas to pay to compensate the bundler for the pre-verification execution and calldata.
     * @param maxFeePerGas Maximum fee per gas (similar to EIP 1559  max_fee_per_gas).
     * @param maxPriorityFeePerGas Maximum priority fee per gas (similar to EIP 1559 max_priority_fee_per_gas).
     * @param paymaster Address sponsoring the transaction (or zero for regular self-sponsored transactions).
     * @param paymasterData Extra data to send to the paymaster.
     */
    function encodeUserOperationData(
        address sender,
        uint256 _nonce,
        bytes calldata callData,
        uint256 callGas,
        uint256 verificationGas,
        uint256 preVerificationGas,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        address paymaster,
        bytes calldata paymasterData
    ) internal view returns (bytes memory) {
        bytes32 _userOperationHash = keccak256(
            abi.encode(
                LASER_OP_TYPEHASH,
                sender,
                _nonce,
                keccak256(callData),
                callGas,
                verificationGas,
                preVerificationGas,
                maxFeePerGas,
                maxPriorityFeePerGas,
                paymaster,
                keccak256(paymasterData)
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
}
