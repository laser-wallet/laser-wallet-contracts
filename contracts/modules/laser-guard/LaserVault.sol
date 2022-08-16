// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.16;

import "../../common/Utils.sol";
import "../../interfaces/IERC20.sol";
import "../../interfaces/ILaserModuleSSR.sol";
import "../../interfaces/ILaserState.sol";
import "../../interfaces/ILaserVault.sol";

/**
 * @title  LaserVault
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Laser guard module that locks assets of a Laser wallet for extra security.
 *         It acts as a vault in the sense that the locked assets cannot be use unless the wallet's
 *         owner (or authorized module) orders otherwise.
 */
contract LaserVault is ILaserVault {
    /*//////////////////////////////////////////////////////////////
                          Init module 
    //////////////////////////////////////////////////////////////*/

    address public immutable LASER_SMART_SOCIAL_RECOVERY;

    /*//////////////////////////////////////////////////////////////
                         ERC-20 function selectors
    //////////////////////////////////////////////////////////////*/

    bytes4 private constant ERC20_TRANSFER = bytes4(keccak256("transfer(address,uint256)"));

    bytes4 private constant ERC20_INCREASE_ALLOWANCE = bytes4(keccak256("increaseAllowance(address,uint256)"));

    /*//////////////////////////////////////////////////////////////
                         ERC-721 function selectors
    //////////////////////////////////////////////////////////////*/

    bytes4 private constant ERC721_SAFE_TRANSFER_FROM =
        bytes4(keccak256("safeTransferFrom(address,address,uint256,bytes)"));

    bytes4 private constant ERC721_SAFE_TRANSFER_FROM2 = bytes4(keccak256("safeTransferFrom(address,address,uint256)"));

    /*//////////////////////////////////////////////////////////////
                         ERC-1155 function selectors
    //////////////////////////////////////////////////////////////*/

    bytes4 private constant ERC1155_SAFE_TRANSFER_FROM =
        bytes4(keccak256("safeTransferFrom(address,address,uint256,uint256,bytes)"));

    bytes4 private constant ERC1155_SAFE_BATCH_TRANSFER_FROM =
        bytes4(keccak256(("safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)")));

    /*//////////////////////////////////////////////////////////////
                         Shared function selectors
    //////////////////////////////////////////////////////////////*/

    bytes4 private constant COMMON_APPROVE = bytes4(keccak256("approve(address,uint256)"));

    bytes4 private constant COMMON_TRANSFER_FROM = bytes4(keccak256("transferFrom(address,address,uint256)"));

    bytes4 private constant COMMON_SET_APPROVAL_FOR_ALL = bytes4(keccak256("setApprovalForAll(address,bool)"));

    /*//////////////////////////////////////////////////////////////
                          ETH encoded address
    //////////////////////////////////////////////////////////////*/

    address private constant ETH = address(bytes20(bytes32(keccak256("ETH.ENCODED.LASER"))));

    /*//////////////////////////////////////////////////////////////
                          Vault's storage
    //////////////////////////////////////////////////////////////*/

    // walletAddress => tokenAddress => amount.
    mapping(address => mapping(address => uint256)) private tokensInVault;

    // walletAddress => nftAddress => tokenId => boolean.
    mapping(address => mapping(address => mapping(uint256 => bool))) private nftsInVault;

    constructor(address smartSocialRecovery) {
        //@todo Check that the smart social recovery is registred in LaserRegistry.
        LASER_SMART_SOCIAL_RECOVERY = smartSocialRecovery;
    }

    /**
     * @notice Verifies that the transaction doesn't spend assets from the vault.
     *
     * @param  wallet   The address of the wallet.
     * @param  to       Destination address.
     * @param  value    Amount in WEI to transfer.
     * @param callData  Data payload for the transaction.
     */
    function verifyTransaction(
        address wallet,
        address to,
        uint256 value,
        bytes calldata callData,
        uint256,
        uint256,
        uint256,
        uint256,
        bytes calldata
    ) external view {
        bytes4 funcSelector = bytes4(callData);

        // If value is greater than 0, then it is an ETH transfer.
        if (value > 0) {
            verifyEth(wallet, value);
        }

        if (funcSelector == ERC20_TRANSFER) {
            verifyERC20Transfer(wallet, to, callData);
        }

        if (funcSelector == COMMON_APPROVE) {
            verifyCommonApprove(wallet, to, callData);
        }

        if (funcSelector == ERC20_INCREASE_ALLOWANCE) {
            verifyERC20IncreaseAllowance(wallet, to, callData);
        }
    }

    /**
     * @notice Adds tokens to vault.
     *
     * @param  token  The address of the token.
     * @param  amount Amount of tokens to add to the vault.
     */
    function addTokensToVault(address token, uint256 amount) external {
        address wallet = msg.sender;

        tokensInVault[wallet][token] += amount;

        emit TokensAdded(token, amount);
    }

    /**
     * @notice Removes tokens from vault.
     *
     * @param  token             The address of the token.
     * @param  amount            Amount of tokens to remove to the vault.
     * @param guardianSignature  Signature of one of the wallet's guardians.
     *                           In order to take tokens out of the vault, it needs to be
     *                           signed by the owner + a guardian.
     */
    function removeTokensFromVault(
        address token,
        uint256 amount,
        bytes calldata guardianSignature
    ) external {
        address wallet = msg.sender;

        // We subtract 1 from the nonce because the nonce was incremented at the
        // beginning of the transaction.
        uint256 walletNonce = ILaserState(wallet).nonce() - 1;

        bytes32 signedHash = keccak256(abi.encodePacked(token, amount, block.chainid, wallet, walletNonce));

        address signer = Utils.returnSigner(signedHash, guardianSignature, 0);

        require(ILaserModuleSSR(LASER_SMART_SOCIAL_RECOVERY).isGuardian(wallet, signer), "Invalid guardian signature");

        tokensInVault[wallet][token] -= amount;

        emit TokensRemoved(token, amount);
    }

    /**
     * @param wallet The address of the wallet.
     * @param token  The address of the token.
     *
     * @return The amount of tokens that are in the vault from the provided token and wallet.
     */
    function getTokensInVault(address wallet, address token) external view returns (uint256) {
        return tokensInVault[wallet][token];
    }

    /**
     * @notice Verifies that the transfer amount is in bounds.
     *
     * @param wallet   The wallet address.
     * @param value    Amount in 'WEI' to transfer.
     */
    function verifyEth(address wallet, uint256 value) internal view {
        // If value is greater than 0, then  it is ETH transfer.
        uint256 walletBalance = address(wallet).balance;

        uint256 ethInVault = tokensInVault[wallet][ETH];

        if (walletBalance - value < ethInVault) revert LaserVault__verifyEth__ethInVault();
    }

    /**
     * @notice Verifies that the transfer amount is in bounds.
     *
     * @param wallet    The wallet address.
     * @param to        The address to transfer the tokens to.
     * @param callData  The calldata of the function.
     */
    function verifyERC20Transfer(
        address wallet,
        address to,
        bytes calldata callData
    ) internal view {
        (, uint256 transferAmount) = abi.decode(callData[4:], (address, uint256));

        uint256 _tokensInVault = tokensInVault[wallet][to];

        uint256 walletTokenBalance = IERC20(to).balanceOf(wallet);

        if (walletTokenBalance - transferAmount < _tokensInVault) {
            revert LaserVault__verifyERC20Transfer__erc20InVault();
        }
    }

    /**
     * @notice Verifies that the spender's allowance is in bounds with the tokens in vault.
     *
     * @param wallet   The wallet address.
     * @param to       The address to transfer the tokens to.
     * @param callData The calldata of the function.
     */
    function verifyCommonApprove(
        address wallet,
        address to,
        bytes calldata callData
    ) internal view {
        (address spender, uint256 amount) = abi.decode(callData[4:], (address, uint256));

        // First we will check if it is ERC20.
        uint256 _tokensInVault = tokensInVault[wallet][to];

        if (_tokensInVault > 0) {
            // Then it is definitely an ERC20.
            uint256 walletTokenBalance = IERC20(to).balanceOf(wallet);

            uint256 spenderAllowance = IERC20(to).allowance(wallet, spender);

            if (walletTokenBalance - (amount + spenderAllowance) < _tokensInVault) {
                revert LaserVault__verifyCommonApprove__erc20InVault();
            }
        }
    }

    /**
     * @notice Verifies that the wallet has enough allowance to transfer the amount of tokens.
     *
     * @param wallet   The wallet address.
     * @param to       The address to transfer the tokens to.
     * @param callData The calldata of the function.
     */
    function verifyERC20IncreaseAllowance(
        address wallet,
        address to,
        bytes calldata callData
    ) internal view {
        (address spender, uint256 addedValue) = abi.decode(callData[4:], (address, uint256));

        uint256 _tokensInVault = tokensInVault[wallet][to];

        uint256 walletTokenBalance = IERC20(to).balanceOf(wallet);

        uint256 spenderCurrentAllowance = IERC20(to).allowance(spender, wallet);
        uint256 spenderNewAllowance = spenderCurrentAllowance + addedValue;

        require(walletTokenBalance - spenderNewAllowance > _tokensInVault, "Allowance exceeds vault.");
    }
}
