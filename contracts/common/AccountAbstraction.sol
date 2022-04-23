// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "../common/SelfAuthorized.sol";
import "../interfaces/IEIP4337.sol";
import "../interfaces/IStakeManager.sol";

/**
 * @title AccountAbstraction - Handles the entry point address. Can only be changed through a safe transaction.
 */
contract AccountAbstraction is SelfAuthorized {
    event EntryPointChanged(address entryPoint);
    // Entrypoint address should always be located at storage slot 1.
    address public entryPoint;

    bytes32 private constant LASER_OP_TYPEHASH =
        keccak256(
            "LaserOp(address sender,uint256 nonce,bytes callData,uint256 callGas,uint256 verificationGas,uint256 preVerificationGas,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,address paymaster,bytes paymasterData)"
        );

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");

    modifier onlyFromEntryPoint() {
        require(msg.sender == entryPoint, "EP: Not Entry Point");
        _;
    }

    /**
     * @dev Withdraws deposits from the Entry Point.
     */
    function withdrawDeposit(uint256 _amount) public authorized {
        require(
            IStakeManager(entryPoint).balanceOf(address(this)) >= _amount,
            "EP: Not enough balance"
        );
        // The stake manager will check for success.
        IStakeManager(entryPoint).withdrawTo(address(this), _amount);
    }

    /**
     * @dev Returns the domain separator for account abstraction transactions.
     */
    function _domainSeparator() public view returns (bytes32) {
        return (
            keccak256(
                abi.encode(
                    DOMAIN_SEPARATOR_TYPEHASH,
                    block.chainid,
                    address(this)
                )
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
                _domainSeparator(),
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
     * @dev Changes the entry point address.
     * @param _entryPoint  new entry point address.
     * @notice The entry point address can execute a transaction without signature requirement
     * If it is a malicious address. There needs to be extra caution in changing the entry point.
     */
    function changeEntryPoint(address _entryPoint) public authorized {
        require(
            _entryPoint != address(this),
            "EP: Incorrect Entry Point address"
        );

        assembly {
            let size := extcodesize(_entryPoint)

            // Entry Point must be a contract.
            if eq(size, 0) {
                revert(0, 0)
            }

            // So we are more explicit.
            // Entry Point should always be at storage slot 1.
            sstore(1, _entryPoint)
        }

        emit EntryPointChanged(entryPoint);
    }
}
