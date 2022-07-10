// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "./core/Singleton.sol";
import "./handlers/Handler.sol";
import "./interfaces/ILaserWallet.sol";
import "./ssr/SSR.sol";

/**
 * @title LaserWallet - EVM based smart contract wallet. Implementes smart social recovery mechanism.
 * @author Rodrigo Herrera I.
 */
contract LaserWallet is ILaserWallet, Singleton, SSR, Handler {
    string public constant VERSION = "1.0.0";

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant LASER_TYPE_STRUCTURE =
        keccak256(
            "LaserOperation(address to,uint256 value,bytes callData,uint256 nonce,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 gasLimit)"
        );

    bytes4 private constant EIP1271_MAGIC_VALUE = bytes4(keccak256("isValidSignature(bytes32,bytes)"));

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
     * @param _recoveryOwners Array of recovery owners. Implementation of Sovereign Social Recovery.
     * @param _guardians Addresses that can activate the social recovery mechanism.
     * @param maxFeePerGas Maximum amount that the user is willing to pay for a unit of gas.
     * @param maxPriorityFeePerGas Miner's tip.
     * @param gasLimit The transaction's gas limit. It needs to be the same as the actual transaction gas limit.
     * @param relayer Address that forwards the transaction so it abstracts away the gas costs.
     * @param signature The signature of the owner. We require the owner's signature for the refund amount and
     * to be confirm the initial wallet configuration.
     * @notice It can't be called after initialization.
     */
    function init(
        address _owner,
        address[] calldata _recoveryOwners,
        address[] calldata _guardians,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes memory signature
    ) external {
        // initOwner() requires that the current owner is address 0.
        // This is enough to protect init() from being called after initialization.
        initOwner(_owner);

        // We initialize the guardians ...
        initGuardians(_guardians);

        // We initialize the recovery owners ...
        initRecoveryOwners(_recoveryOwners);

        // We check the correctness of the signature (belongs to the owner).
        // This is so the wallet refunds the specified amount to the relayer.

        // Check the signature of the owner.
        // This is so the wallet refunds the specified amount to the relayer.
        bytes32 signedHash = keccak256(abi.encodePacked(maxFeePerGas, maxPriorityFeePerGas, gasLimit));

        (bytes32 r, bytes32 s, uint8 v) = splitSigs(signature, 0);

        address signer = returnSigner(signedHash, r, s, v, signature);

        //@todo Optimize this.
        if (signer != _owner) revert LW__init__notOwner();

        if (gasLimit > 0) {
            // If gas limit is greater than 0, then the transaction was sent through a relayer.
            // We calculate the gas price, as per the user's request ...
            uint256 gasPrice = calculateGasPrice(maxFeePerGas, maxPriorityFeePerGas);

            // gasUsed is the total amount of gas consumed for this transaction.
            // This is contemplating the initial callData cost, the main transaction,
            // and we add the surplus for what is left (refund the relayer).
            uint256 gasUsed = gasLimit - gasleft() + 7000;

            uint256 refundAmount = gasUsed * gasPrice;

            // We refund the relayer ...
            bool success = _call(relayer == address(0) ? tx.origin : relayer, refundAmount, new bytes(0), gasleft());

            // If the transaction returns false, we revert ..
            if (!success) revert LW__exec__refundFailure();
        }

        emit Setup(_owner, _recoveryOwners, _guardians);
    }

    /**
     * @dev Executes a generic transaction. It does not support 'delegatecall' for security reasons.
     * @param to Destination address.
     * @param value Amount to send.
     * @param callData Data payload for the transaction.
     * @param _nonce Unsigned integer to avoid replay attacks. It needs to match the current wallet's nonce.
     * @param maxFeePerGas Maximum amount that the user is willing to pay for a unit of gas.
     * @param maxPriorityFeePerGas Miner's tip.
     * @param gasLimit The transaction's gas limit. It needs to be the same as the actual transaction gas limit.
     * @param relayer Address that forwards the transaction so it abstracts away the gas costs.
     * @param signatures The signatures of the transaction.
     * @notice If 'gasLimit' does not match the actual gas limit of the transaction, the relayer can incur losses.
     * It is the relayer's responsability to make sure that they are the same, the user does not get affected if a mistake is made.
     * We prefer to prioritize the user's safety (not overpay) over the relayer.
     */
    function exec(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes calldata signatures
    ) external {
        // We immediately increase the nonce to avoid replay attacks.
        unchecked {
            // Won't overflow ...
            if (nonce++ != _nonce) revert LW__exec__invalidNonce();
        }

        // Verifies the correctness of the transaction. It checks that the signatures are
        // correct and that the signer has access for the transaction.
        verifyTransaction(to, value, callData, _nonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit, signatures);

        // Once we verified that the transaction is correct, we execute the main call.
        // We subtract 10_000 to have enough gas to complete the function.
        bool success = _call(to, value, callData, gasleft() - 10000);

        // We do not revert the call if it fails, because the wallet needs to pay the relayer even in case of failure.
        if (success) emit ExecSuccess(to, value, nonce);
        else emit ExecFailure(to, value, nonce);

        // We calculate the gas price, as per the user's request ...
        uint256 gasPrice = calculateGasPrice(maxFeePerGas, maxPriorityFeePerGas);

        // gasUsed is the total amount of gas consumed for this transaction.
        // This is contemplating the initial callData cost, the main transaction,
        // and we add the surplus for what is left (refund the relayer).
        uint256 gasUsed = gasLimit - gasleft() + 7000;

        uint256 refundAmount = gasUsed * gasPrice;

        // We refund the relayer ...
        success = _call(relayer == address(0) ? tx.origin : relayer, refundAmount, new bytes(0), gasleft());

        // If the transaction returns false, we revert ..
        if (!success) revert LW__exec__refundFailure();
    }

    /**
     * @dev Executes a series of generic transactions. It can only be called from exec.
     * @param transactions Basic transactions array (to, value, calldata).
     */
    function multiCall(Transaction[] calldata transactions) external onlyMe {
        uint256 transactionsLength = transactions.length;
        for (uint256 i = 0; i < transactionsLength; ) {
            Transaction calldata transaction = transactions[i];

            // We get the actual function selector to determine access ...
            bytes4 funcSelector = bytes4(transaction.callData);

            // access() checks if the wallet is locked for the owner or guardians and returns who has access ...
            Access access = access(funcSelector);

            // Only the owner is allowed to trigger a multiCall.
            // The signatures were already verified in 'exec', here we just need to make sure that access == owner.
            if (access != Access.Owner) revert LW__multiCall__notOwner();

            bool success = _call(transaction.to, transaction.value, transaction.callData, gasleft());

            // We do not revert the call if it fails, because the wallet needs to pay the relayer even in case of failure.
            (success);

            //@todo Return the success transactions and return data in an array.

            unchecked {
                // Won't overflow .... You would need way more gas usage than current available block gas (30m) to overflow it.
                ++i;
            }
        }
    }

    /**c
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
        uint256 gasLimit,
        bytes calldata signatures
    ) external returns (uint256 totalGas) {
        if (nonce++ != _nonce) revert LW__simulateTransaction__invalidNonce();
        verifyTransaction(to, value, callData, _nonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit, signatures);
        bool success = _call(to, value, callData, gasleft());
        if (!success) revert LW__simulateTransaction__mainCallError();
        uint256 gasPrice = calculateGasPrice(maxFeePerGas, maxPriorityFeePerGas);
        uint256 gasUsed = gasLimit - gasleft() + 7000;
        uint256 refundAmount = gasUsed * gasPrice;
        success = _call(msg.sender, refundAmount, new bytes(0), gasleft());
        if (!success) revert LW__simulateTransaction__refundFailure();
        totalGas = gasLimit - gasleft();
        require(msg.sender == address(0), "Must be called off-chain from address zero.");
    }

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
        uint256 gasLimit
    ) external view returns (bytes32) {
        return keccak256(encodeOperation(to, value, callData, _nonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit));
    }

    /**
     * @dev Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * @param hash Hash of a message signed on behalf of address(this).
     * @param signature Signature byte array associated with _msgHash.
     * @return Magic value  or reverts with an error message.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        (r, s, v) = splitSigs(signature, 0);
        address recovered = returnSigner(hash, r, s, v, signature);

        // The guardians and recovery owners should not be able to sign transactions that are out of scope from this wallet.
        // Only the owner should be able to sign external data.
        if (recovered != owner) revert LaserWallet__invalidSignature();
        return EIP1271_MAGIC_VALUE;
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
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, getChainId(), address(this)));
    }

    /**
     * @dev Verifies that the transaction is correct (signatures match the parameters).
     */
    function verifyTransaction(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
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
            gasLimit
        );

        // Now we hash it ...
        bytes32 dataHash = keccak256(encodedData);

        // We get the actual function selector to determine access ...
        bytes4 funcSelector = bytes4(callData);

        // access() checks if the wallet is locked for the owner or guardians and returns who has access ...
        Access access = access(funcSelector);

        // We verify that the signatures are correct depending on the transaction type ...
        verifySignatures(access, dataHash, signatures);
    }

    /**
     * @dev Verifies that the signature(s) match the transaction type and sender.
     * @param _access Who has permission to invoke this transaction.
     * @param dataHash The keccak256 has of the transaction's data playload.
     * @param signatures The signature(s) of the hash.
     */
    function verifySignatures(
        Access _access,
        bytes32 dataHash,
        bytes calldata signatures
    ) internal view {
        // If it is the owner or guardian, then only 1 signature is required.
        // For all other operations, 2 signatures are required.
        uint256 requiredSignatures = _access == Access.Owner || _access == Access.Guardian ? 1 : 2;

        if (signatures.length < requiredSignatures * 65) revert LW__verifySignatures__invalidSignatureLength();

        address signer;
        bytes32 r;
        bytes32 s;
        uint8 v;

        for (uint256 i = 0; i < requiredSignatures; ) {
            (r, s, v) = splitSigs(signatures, i);

            signer = returnSigner(dataHash, r, s, v, signatures);

            if (_access == Access.Owner) {
                // If access == owner, the signer needs to be the owner.

                // We do not need further checks e.g 'is the wallet locked', they were done in 'access'.
                if (owner != signer) revert LW__verifySignatures__notOwner();
            } else if (_access == Access.Guardian) {
                // If access == guardian, the signer needs to be a guardian.

                // The guardian by itself can only lock the wallet, additional checks were done in 'access'.
                if (guardians[signer] == address(0)) revert LW__verifySignatures__notGuardian();
            } else if (_access == Access.OwnerAndGuardian) {
                // If access == owner and guardian, the first signer needs to be the owner.
                if (i == 0) {
                    // The first signer needs to be the owner.
                    if (owner != signer) revert LW__verifySignatures__notOwner();
                } else {
                    // The second signer needs to be a guardian.
                    if (guardians[signer] == address(0)) revert LW__verifySignatures__notGuardian();
                }
            } else if (_access == Access.RecoveryOwnerAndGuardian) {
                // If access == recovery owner and guardian, the first signer needs to be the recovery owner.

                // We do not need further checks, they were done in 'access'.
                if (i == 0) {
                    // The first signer needs to be a recovery owner.

                    // validateRecoveryOwner() handles all the necessary checks.
                    validateRecoveryOwner(signer);
                } else {
                    // The second signer needs to be a guardian.
                    if (guardians[signer] == address(0)) revert LW__verifySignatures__notGuardian();
                }
            } else if (_access == Access.OwnerAndRecoveryOwner) {
                // If access == owner and recovery owner, the first signer needs to be the owner.

                if (i == 0) {
                    if (owner != signer) revert LW__verifySignatures__notOwner();
                } else {
                    // The second signer needs to be the recovery owner.

                    // validateRecoveryOwner() handles all the necessary checks.
                    validateRecoveryOwner(signer);
                }
            } else {
                // This else statement should never reach.
                revert();
            }

            unchecked {
                // Won't overflow ...
                ++i;
            }
        }
    }

    function encodeOperation(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit
    ) internal view returns (bytes memory) {
        bytes32 opHash = keccak256(
            abi.encode(
                LASER_TYPE_STRUCTURE,
                to,
                value,
                keccak256(callData),
                _nonce,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasLimit
            )
        );

        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), opHash);
    }
}
