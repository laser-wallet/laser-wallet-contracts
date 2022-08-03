// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

///@title ILaserWallet
///@author Rodrigo Herrera I.
///@notice Has all the external functions, structs, events and errors for LaserWallet.sol.
interface ILaserWallet {
    event Received(address indexed sender, uint256 amount);
    event Setup(address owner, address laserModule);
    event ExecSuccess(address to, uint256 value, uint256 nonce);
    event ExecFailure(address to, uint256 value, uint256 nonce);

    ///@dev init() custom error.
    error LW__init__notOwner();
    error LW__init__refundFailure();

    ///@dev exec() custom errors.
    error LW__exec__invalidNonce();
    error LW__exec__walletLocked();
    error LW__exec__notOwner();
    error LW__exec__refundFailure();

    ///@dev isValidSignature() Laser custom error.
    error LaserWallet__invalidSignature();

    ///@dev Setup function, sets initial storage of the wallet.
    ///@param laserModule Authorized Laser module that can execute transactions for this wallet.
    ///@notice It can't be called after initialization.
    function init(
        address _owner,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        address laserModule,
        address _masterGuard,
        address _laserRegistry,
        bytes calldata laserModuleData,
        bytes calldata ownerSignature
    ) external;

    ///@dev Executes a generic transaction. It does not support 'delegatecall' for security reasons.
    ///@notice If 'gasLimit' does not match the actual gas limit of the transaction, the relayer can incur losses.
    ///It is the relayer's responsability to make sure that they are the same, the user does not get affected if a mistake is made.
    ///We prefer to prioritize the user's safety (not overpay) over the relayer.
    function exec(
        address to,
        uint256 value,
        bytes calldata callData,
        uint256 _nonce,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        bytes calldata ownerSignature
    ) external returns (bool success);

    ///@dev Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
    ///@param hash Hash of a message signed on behalf of address(this).
    ///@param signature Signature byte array associated with _msgHash.
    ///@return Magic value  or reverts with an error message.
    function isValidSignature(bytes32 hash, bytes memory signature) external returns (bytes4);
}
