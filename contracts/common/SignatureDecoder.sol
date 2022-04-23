// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "../libraries/ECDSA.sol";

/**
 * @title SignatureDecoder - Decodes signatures that a encoded as bytes.
 * @author Modified from Gnosis Safe.
 */
contract SignatureDecoder {
    using ECDSA for bytes32;

    /**
     * @dev divides bytes signature into `uint8 v, bytes32 r, bytes32 s`.
     * @notice Make sure to perform a bounds check for @param pos, to avoid out of bounds access on @param signatures.
     * @param pos which signature to read. A prior bounds check of this parameter should be performed, to avoid out of bounds access.
     * @param signatures concatenated rsv signatures.
     */
    function signatureSplit(bytes memory signatures, uint256 pos)
        internal
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let signaturePos := mul(0x41, pos)
            r := mload(add(signatures, add(signaturePos, 0x20)))
            s := mload(add(signatures, add(signaturePos, 0x40)))
            // Here we are loading the last 32 bytes, including 31 bytes
            // of 's'. There is no 'mload8' to do this.
            //
            // 'byte' is not working due to the Solidity parser, so lets
            // use the second best option, 'and'
            v := and(mload(add(signatures, add(signaturePos, 0x41))), 0xff)
        }
    }

    /**
     * @dev Gets the first signer of a given signature (first 65 bytes).
     */
    function getFirstSigner(bytes32 _hash, bytes memory _signatures)
        internal
        view
        returns (address signer)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;
        require(_signatures.length >= 65, "SD: Invalid signature length");
        (v, r, s) = signatureSplit(_signatures, 0);
        if (v > 30) {
            signer = keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
            ).recover(v - 4, r, s);
        } else {
            signer = _hash.recover(v, r, s);
        }
    }
}
