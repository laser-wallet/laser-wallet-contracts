// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

/**
 * @title IUtils
 * @notice Has all the external functions and errors for Utils.sol.
 */
interface IUtils {
    ///@dev returnSigner() custom error.
    error Utils__returnSigner__invalidSignature();

    /**
     * @dev Returns the signer of the hash.
     * @param dataHash The hash that was signed.
     */
    function returnSigner(
        bytes32 dataHash,
        bytes32 r,
        bytes32 s,
        uint8 v,
        bytes memory signatures
    ) external view returns (address signer);

    /**
     * @dev Returns the r, s and v of the signature.
     * @param signatures Signature.
     * @param pos Which signature to read.
     */
    function splitSigs(bytes memory signatures, uint256 pos)
        external
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        );
}
