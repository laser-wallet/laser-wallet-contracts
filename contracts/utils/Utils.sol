// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.14;

/**
 * @title Utils - Helper functions for LaserWallet.
 */
contract Utils {
    error Utils__InvalidSignature();

    /**
     * @dev Returns the signer of the hash.
     * @param dataHash The hash that was signed.
     * @param signature Signature of the hash.
     */
    function returnSigner(bytes32 dataHash, bytes memory signature)
        public
        pure
        returns (address signer)
    {
        bytes32 r;
        bytes32 s;
        uint8 v;
        (r, s, v) = splitSig(signature);
        if (v > 30) {
            signer = ecrecover(
                keccak256(
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n32",
                        dataHash
                    )
                ),
                v - 4,
                r,
                s
            );
        } else {
            signer = ecrecover(dataHash, v, r, s);
        }
        if (signer == address(0)) revert Utils__InvalidSignature();
    }

    /**
     * @dev Returns the r, s and v of the signature.
     * @param signature by the owner.
     */
    function splitSig(bytes memory signature)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
    }

    /**
     * @dev Calls a target address, sends value and / or data payload.
     * @param to Destination address.
     * @param value Amount to send in ETH.
     * @param data Data payload.
     * @param txGas Amount of gas to forward.
     */
    function execute(
        address to,
        uint256 value,
        bytes memory data,
        uint256 txGas
    ) internal returns (bool success) {
        assembly {
            // We execute a call to the target address and return boolean...
            success := call(
                txGas,
                to,
                value,
                add(data, 0x20),
                mload(data),
                0,
                0
            )
        }
    }
}
