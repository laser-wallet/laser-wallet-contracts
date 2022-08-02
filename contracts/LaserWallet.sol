// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "./handlers/Handler.sol";
import "./interfaces/ILaserWallet.sol";
import "./state/LaserState.sol";

interface ILaserGuard {
    function verifyTransaction(
        address wallet,
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        bytes calldata signature
    ) external;
}

/**
 * @title  LaserWallet
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Laser is a modular smart contract wallet made for the Ethereum Virtual Machine.
 *         It has modularity (programmability) and security at its core.
 */
contract LaserWallet is ILaserWallet, LaserState, Handler {
    string public constant VERSION = "1.0.0";

    bytes4 private constant EIP1271_MAGIC_VALUE = bytes4(keccak256("isValidSignature(bytes32,bytes)"));

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    bytes32 private constant LASER_TYPE_STRUCTURE =
        keccak256(
            "LaserOperation(address to,uint256 value,bytes callData,uint256 nonce,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 gasLimit)"
        );

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
     * @param _owner                The owner of the wallet.
     * @param maxFeePerGas          Maximum WEI the owner is willing to pay per unit of gas.
     * @param maxPriorityFeePerGas  Miner's tip.
     * @param gasLimit              Maximum amount of gas the owner is willing to use for this transaction.
     * @param relayer               Address to refund for the inclusion of this transaction.
     * @param laserModule           Address of the initial module to setup -> Smart Social Recovery.
     * @param laserModuleData       Initialization data for the provided module.
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
        // activateWallet verifies that the current owner is address 0, reverts otherwise.
        // This is more than enough to avoid being called after initialization.
        activateWallet(_owner, laserModule, laserModuleData);

        // This is to ensure that the owner authorized the amount of gas.
        bytes32 signedHash = keccak256(abi.encodePacked(maxFeePerGas, maxPriorityFeePerGas, gasLimit, block.chainid));
        address signer = Utils.returnSigner(signedHash, ownerSignature, 0);
        if (signer != _owner) revert LW__init__notOwner();

        if (gasLimit > 0) {
            // Using infura relayer for now ...
            uint256 fee = (tx.gasprice / 100) * 6;
            uint256 gasPrice = tx.gasprice + fee;

            gasLimit = (gasLimit * 3150) / 3200;
            uint256 gasUsed = gasLimit - gasleft() + 8000;

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
     * @notice Executes a generic transaction.
     *         If 'gasLimit' does not match the actual gas limit of the transaction, the relayer can incur losses.
     *         It is the relayer's responsability to make sure that they are the same,
     *         the user does not get affected if a mistake is made.
     *
     * @param to                    Destination address.
     * @param value                 Amount in WEI to transfer.
     * @param callData              Data payload for the transaction.
     * @param _nonce                Anti-replay number.
     * @param maxFeePerGas          Maximum WEI the owner is willing to pay per unit of gas.
     * @param maxPriorityFeePerGas  Miner's tip.
     * @param gasLimit              Maximum amount of gas the owner is willing to use for this transaction.
     * @param relayer               Address to refund for the inclusion of this transaction.
     * @param signatures            The signature(s) of the hash of this transaction.
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
    ) external returns (bool success) {
        {
            // We immediately increase the nonce to avoid replay attacks.
            unchecked {
                if (nonce++ != _nonce) revert LW__exec__invalidNonce();
            }

            // If the wallet is locked, further transactions cannot be executed from 'exec'.
            if (isLocked) revert LW__exec__walletLocked();

            // We get the hash of this transaction.
            bytes32 signedHash = keccak256(
                encodeOperation(to, value, callData, _nonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit)
            );

            // We get the signer of the hash of this transaction.
            address signer = Utils.returnSigner(signedHash, signatures, 0);

            // The signer must be the owner.
            if (signer != owner) revert LW__exec__notOwner();

            // We execute the main transaction but we keep 10_000 units of gas for the remaining operations.
            success = Utils.call(to, value, callData, gasleft() - 10000);

            // We do not revert the call if it fails, because the wallet needs to pay the relayer even in case of failure.
            if (success) emit ExecSuccess(to, value, nonce);
            else emit ExecFailure(to, value, nonce);
        }

        // If the guard module is activated, we call it with the transaction information.
        if (laserGuard != address(0)) {
            ILaserGuard(laserGuard).verifyTransaction(
                address(this),
                to,
                value,
                callData,
                _nonce,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasLimit,
                signatures
            );
        }

        if (gasLimit > 0) {
            // If gas limit is greater than 0, it means that the call was relayed.

            // We are using Infura's relayer for now ...
            uint256 fee = (tx.gasprice / 100) * 6;
            uint256 gasPrice = tx.gasprice + fee;
            uint256 gasUsed = gasLimit - gasleft() + 7000;
            uint256 refundAmount = gasUsed * gasPrice;

            success = Utils.call(relayer == address(0) ? tx.origin : relayer, refundAmount, new bytes(0), gasleft());
            if (!success) revert LW__exec__refundFailure();
        }
    }

    /**
     * @notice Executes a transaction from an authorized module.
     *         If 'gasLimit' does not match the actual gas limit of the transaction, the relayer can incur losses.
     *         It is the relayer's responsability to make sure that they are the same,
     *         the user does not get affected if a mistake is made.
     *
     * @param to                    Destination address.
     * @param value                 Amount in WEI to transfer.
     * @param callData              Data payload for the transaction.
     * @param maxFeePerGas          Maximum WEI the owner is willing to pay per unit of gas.
     * @param maxPriorityFeePerGas  Miner's tip.
     * @param gasLimit              Maximum amount of gas the owner is willing to use for this transaction.
     * @param relayer               Address to refund for the inclusion of this transaction.
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
        // We quiet compiler warnings.
        (maxFeePerGas, maxPriorityFeePerGas);
        unchecked {
            nonce++;
        }
        ///@todo custom errors instead of require statement.
        require(laserModules[msg.sender] != address(0), "nop module");

        bool success = Utils.call(to, value, callData, gasleft() - 10000);

        require(success, "main call failed");

        if (gasLimit > 0) {
            // Using infura relayer for now ...
            uint256 fee = (tx.gasprice / 100) * 6;
            uint256 gasPrice = tx.gasprice + fee;
            gasLimit = (gasLimit * 63) / 64;
            uint256 gasUsed = gasLimit - gasleft() + 7000;
            uint256 refundAmount = gasUsed * gasPrice;

            success = Utils.call(relayer == address(0) ? tx.origin : relayer, refundAmount, new bytes(0), gasleft());

            require(success, "refund failed");
        }
    }

    /**
     * @notice Simulates a transaction.
     *         It needs to be called off-chain from address(0).
     *
     * @param to                    Destination address.
     * @param value                 Amount in WEI to transfer.
     * @param callData              Data payload for the transaction.
     * @param _nonce                Anti-replay number.
     * @param maxFeePerGas          Maximum WEI the owner is willing to pay per unit of gas.
     * @param maxPriorityFeePerGas  Miner's tip.
     * @param gasLimit              Maximum amount of gas the owner is willing to use for this transaction.
     * @param relayer               Address to refund for the inclusion of this transaction.
     * @param signatures            The signature(s) of the hash of this transaction.
     *
     * @return gasUsed The gas used for this transaction.
     */
    function simulateTransaction(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes calldata signatures
    ) external returns (uint256 gasUsed) {
        bool success;
        {
            require(nonce++ == _nonce, "SIMULATION: Incorrect nonce");
            require(!isLocked, "SIMULATION, Wallet is locked");

            bytes32 signedHash = keccak256(
                encodeOperation(to, value, callData, _nonce, maxFeePerGas, maxPriorityFeePerGas, gasLimit)
            );
            address signer = Utils.returnSigner(signedHash, signatures, 0);
            require(signer == owner, "SIMULATION: Signer is not the owner");
            success = Utils.call(to, value, callData, gasleft() - 10000);
            require(success, "SIMULATION: Main call failed");
        }
        if (laserGuard != address(0)) {
            ILaserGuard(laserGuard).verifyTransaction(
                address(this),
                to,
                value,
                callData,
                _nonce,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasLimit,
                signatures
            );
        }
        // Using infura relayer for now ...
        uint256 fee = (tx.gasprice / 100) * 6;
        uint256 gasPrice = tx.gasprice + fee;
        gasUsed = gasLimit - gasleft() + 7000;
        uint256 refundAmount = gasUsed * gasPrice;
        success = Utils.call(relayer == address(0) ? tx.origin : relayer, refundAmount, new bytes(0), gasleft());
        require(success, "SIMULATION: Refund failed");
        require(msg.sender == address(0), "SIMULATION: Must be called off-chain from address(0)");
    }

    /**
     * @notice Locks the wallet. Once locked, only the SSR module can unlock it or recover it.
     */
    function lock() external access {
        isLocked = true;
    }

    /**
     * @notice Unlocks the wallet. Can only be unlocked or recovered from the SSR module.
     */
    function unlock() external access {
        isLocked = false;
    }

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
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        address recovered = Utils.returnSigner(hash, signature, 0);

        if (recovered != owner || isLocked) revert LaserWallet__invalidSignature();
        return EIP1271_MAGIC_VALUE;
    }

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
     * @return chainId The chain id of this.
     */
    function getChainId() public view returns (uint256 chainId) {
        return block.chainid;
    }

    /**
     * @return
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, getChainId(), address(this)));
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
