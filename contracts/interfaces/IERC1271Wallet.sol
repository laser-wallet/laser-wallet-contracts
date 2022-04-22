// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

interface IERC1271Wallet {
    /**
     * @notice Implementation of EIP 1271: https://eips.ethereum.org/EIPS/eip-1271.
     * Should return whether the signature provided is valid for the provided data.
     * @param _hash Hash of a message signed on the behalf of address(this)
     * @param _signature Signature byte array associated with _msgHash
     */
    function isValidSignature(bytes32 _hash, bytes memory _signature)
        external
        view
        returns (bytes4);
}
