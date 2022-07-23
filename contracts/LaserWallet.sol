// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "./common/Common.sol";
import "./handlers/Handler.sol";
import "./interfaces/ILaserWallet.sol";
import "./state/LaserState.sol";

interface ILaserGuard {
    function checkTransaction(address to) external;
}

/**
 * @title LaserWallet - EVM based smart contract wallet. Implementes smart social recovery mechanism.
 * @author Rodrigo Herrera I.
 */
contract LaserWallet is ILaserWallet, Common, LaserState, Handler {
    bytes4 private constant EIP1271_MAGIC_VALUE = bytes4(keccak256("isValidSignature(bytes32,bytes)"));

    constructor() {
        owner = address(this);
    }

    receive() external payable {}

    /**
     * @dev Setup function, sets initial storage of the wallet.
     * @param _owner The owner of the wallet.
     * @param maxFeePerGas The maximum amount of WEI the user is willing to pay per unit of gas.
     * @param maxPriorityFeePerGas Miner's tip.
     * @param gasLimit Maximum units of gas the user is willing to use for the transaction.
     * @param relayer Address of the relayer to pay back for the transaction inclusion.
     * @param laserModule Authorized Laser modules that can execute transactions for this wallet.
     * @param ownerSignature The signature of the owner to make sure that it approved the transaction.
     * @notice It can't be called after initialization.
     */
    function init(
        address _owner,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        address laserModule,
        bytes calldata laserModuleData,
        bytes calldata ownerSignature
    ) external {
        activateWallet(_owner, laserModule, laserModuleData);

        bytes32 signedHash = keccak256(abi.encodePacked(maxFeePerGas, maxPriorityFeePerGas, gasLimit, block.chainid));

        address signer = Utils.returnSigner(signedHash, ownerSignature, 0);

        if (signer != _owner) revert LW__init__notOwner();

        if (gasLimit > 0) {
            // If gas limit is greater than 0, then the transaction was sent through a relayer.
            // We calculate the gas price, as per the user's request.
            uint256 gasPrice = Utils.calculateGasPrice(maxFeePerGas);

            // gasUsed is the total amount of gas consumed for this transaction.
            // This is contemplating the initial callData cost, the main transaction,
            // and we add the surplus for what is left (refund the relayer).
            uint256 gasUsed = gasLimit - gasleft() + 7000;
            uint256 refundAmount = gasUsed * gasPrice;

            bool success = Utils.call(
                relayer == address(0) ? tx.origin : relayer,
                refundAmount,
                new bytes(0),
                gasleft()
            );

            if (!success) revert LW__init__refundFailure();
        }
        // emit Setup(_owner, laserModule);
    }

    /**
     * @dev Executes a generic transaction. It does not support 'delegatecall' for security reasons.
     * @param to Destination address.
     * @param value Amount to send.
     * @param callData Data payload for the transaction.
     * @param ownerSignature The signatures of the transaction.
     * @notice If 'gasLimit' does not match the actual gas limit of the transaction, the relayer can incur losses.
     * It is the relayer's responsability to make sure that they are the same, the user does not get affected if a mistake is made.
     * We prefer to prioritize the user's safety (not overpay) over the relayer.
     */
    function exec(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes calldata ownerSignature
    ) external {
        // We immediately increase the nonce to avoid replay attacks.
        unchecked {
            nonce++;
        }

        require(!isLocked, "wallet locked");

        bytes32 signedHash = keccak256(
            encodeOperation(to, value, callData, nonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit)
        );

        address signer = Utils.returnSigner(signedHash, ownerSignature, 0);

        require(signer == owner, "nop");

        bool success = Utils.call(to, value, callData, gasleft() - 10000);

        if (laserGuard != address(0)) {
            ILaserGuard(laserGuard).checkTransaction(to);
        }

        // We do not revert the call if it fails, because the wallet needs to pay the relayer even in case of failure.
        // if (success) emit ExecSuccess(to, value, nonce);
        // else emit ExecFailure(to, value, nonce);

        uint256 gasPrice = Utils.calculateGasPrice(maxFeePerGas);

        // We get the gas used and add the surplus for what is left (refund the relayer).
        uint256 gasUsed = gasLimit - gasleft() + 7000;
        uint256 refundAmount = gasUsed * gasPrice;

        success = Utils.call(relayer == address(0) ? tx.origin : relayer, refundAmount, new bytes(0), gasleft());

        // if (!success) revert LW__exec__refundFailure();
    }

    /**
     * @dev Allows to execute a transaction from an authorized module.
     */
    function execFromModule(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer
    ) external {
        require(laserModules[msg.sender] != address(0), "nop");
        unchecked {
            nonce++;
        }

        bool success = Utils.call(to, value, callData, gasleft() - 10000);
    }

    function lock() external access {
        isLocked = true;
    }

    function unlock() external access {
        isLocked = false;
    }

    /**
     * @dev Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * @param hash Hash of a message signed on behalf of address(this).
     * @param signature Signature byte array associated with _msgHash.
     * @return Magic value  or reverts with an error message.
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        address recovered = Utils.returnSigner(hash, signature, 0);

        // The guardians and recovery owners should not be able to sign transactions that are out of scope from this wallet.
        // Only the owner should be able to sign external data.
        // if (recovered != owner || isLocked) revert LaserWallet__invalidSignature();
        return EIP1271_MAGIC_VALUE;
    }
}
