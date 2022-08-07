// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

//@todo Move this to an interface
interface ITokens {
    function balanceOf(address _owner) external view returns (uint256);

    function ownerOf(uint256 _tokenId) external view returns (address);

    function balanceOfBatch(address[] memory accounts, uint256[] memory ids) external view;

    function allowance(address owner, address spender) external view returns (uint256);
}
error LaserVault__verifyEth__ethInVault();

/////////////////////////ab

/**
 * @title  LaserVault
 *
 * @author Rodrigo Herrera I.
 *
 * @notice Laser guard module that locks assets of a Laser wallet for extra security.
 *         It acts as a vault in the sense that the locked assets cannot be use unless the wallet's
 *         owner (or authorized module) orders otherwise.
 */
contract LaserVault {
    /*//////////////////////////////////////////////////////////////
                         ERC-20 function selectors
    //////////////////////////////////////////////////////////////*/

    bytes4 private constant ERC20_TRANSFER = bytes4(keccak256("transfer(address,uint256"));

    bytes4 private constant ERC20_INCREASE_ALLOWANCE = bytes4(keccak256("increaseAllowance(address,uint256"));

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

        // If the function selector equals ERC20_INCREASE_ALLOWANCE or
        // ERC20_TRANSFER, it is ERC20 allowance or transfer.
        if (funcSelector == ERC20_INCREASE_ALLOWANCE || funcSelector == ERC20_TRANSFER) {
            verifyERC20(wallet, to, callData);
        }

        // If value is greater than 0, then it is ETH transfer.
        if (value > 0) {
            verifyEth(wallet, value);
        }

        // If the function selector equals COMMON_APPROVE, it can be
        // either ERC20 or ERC721.
        if (funcSelector == COMMON_APPROVE) {
            verifyCommonApprove(wallet, to, callData);
        }
    }

    function addTokensToVault(address token, uint256 amount) external {
        address wallet = msg.sender;

        tokensInVault[wallet][token] += amount;
    }

    function removeTokensFromVault(address token, uint256 amount) external {
        address wallet = msg.sender;

        //@todo Check that the wallet has enough tokens.
        tokensInVault[wallet][token] -= amount;
    }

    // function addNftToVault(address nft, uint256 index) external {
    //     address wallet = msg.sender;

    //     require(ITokens(nft).ownerOf(index) == wallet, "Can't add nft to vault");
    //     nftsInVault[wallet][nft][index] = true;
    // }

    function verifyERC20(
        address wallet,
        address to,
        bytes calldata callData
    ) internal view {
        (, uint256 transferAmount) = abi.decode(callData[4:], (address, uint256));

        uint256 _tokensInVault = tokensInVault[wallet][to];

        uint256 walletTokenBalance = ITokens(to).balanceOf(wallet);

        require(walletTokenBalance - transferAmount > _tokensInVault, "Transfer or allowance exceeds balance.");
    }

    function verifyTokens(
        address wallet,
        address to,
        bytes calldata callData
    ) internal view {
        // We need to decode the amount and check that it is in bounds.
        (, uint256 transferAmount) = abi.decode(callData[4:], (address, uint256));

        uint256 walletTokenBalance = ITokens(to).balanceOf(wallet);

        uint256 _tokensInVault = tokensInVault[wallet][to];

        require(walletTokenBalance - transferAmount > _tokensInVault, "Nop tokens");
    }

    function verifyEth(address wallet, uint256 value) internal view {
        // If value is greater than 0, then  it is ETH transfer.
        uint256 walletBalance = address(wallet).balance;

        uint256 ethInVault = tokensInVault[wallet][ETH];

        if (walletBalance - value < ethInVault) revert LaserVault__verifyEth__ethInVault();
    }

    // function verifyNfts(
    //     address wallet,
    //     address to,
    //     bytes calldata callData
    // ) internal view {
    //     // If func selectorequals nfts approve selector, then it is nfts approval.
    //     // We still need to make sure that the token approved is not in the vault.
    //     (, uint256 nft) = abi.decode(callData[4:], (address, uint256));

    //     require(!nftsInVault[wallet][to][nft], "nop nft approve");
    // }

    function verifyCommonApprove(
        address wallet,
        address to,
        bytes calldata callData
    ) internal view {
        //@todo Check the allowance, just approve the exact allowance for this transaction.
        (, uint256 amount) = abi.decode(callData[4:], (address, uint256));

        // First we will check if it is ERC20.
        uint256 _tokensInVault = tokensInVault[wallet][to];

        if (_tokensInVault > 0) {
            // Then it is definitely an ERC20.
            uint256 walletTokenBalance = ITokens(to).balanceOf(wallet);
        }

        // require(walletTokenBalance - amountOrIndex > _tokensInVault, "ERC20 Allowance exceeds vault.");
        // } else {
        //     // Else, it can be ERC721.
        //     require(!nftsInVault[wallet][to][amountOrIndex], "ERC721 Allowance exceeds vault.");
        // }
    }

    function getTokensInVault(address wallet, address token) external view returns (uint256) {
        return tokensInVault[wallet][token];
    }
}
