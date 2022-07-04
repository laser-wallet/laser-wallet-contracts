// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../interfaces/IUtils.sol";
import "../interfaces/IEIP1271.sol";

/**
 * @title Utils - Helper functions for LaserWallet.
 */
contract Utils is IUtils {
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
    ) public view returns (address signer) {
        if (v == 0) {
            // If v is 0, then it is a contract signature.

            // The address of the contract is encoded into r.
            signer = address(uint160(uint256(r)));

            // The actual signature.
            bytes memory contractSignature;

            assembly {
                contractSignature := add(add(signatures, s), 0x20)
            }

            if (
                IEIP1271(signer).isValidSignature(
                    dataHash,
                    contractSignature
                ) != 0x1626ba7e
            ) revert Utils__returnSigner__invalidContractSignature();
        } else if (v > 30) {
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
        if (signer == address(0)) {
            revert Utils__returnSigner__invalidSignature();
        }
    }

    /**
     * @dev Returns the r, s and v of the signature.
     * @param signatures Signature.
     * @param pos Which signature to read.
     */
    function splitSigs(bytes memory signatures, uint256 pos)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        assembly {
            let sigPos := mul(0x41, pos)
            r := mload(add(signatures, add(sigPos, 0x20)))
            s := mload(add(signatures, add(sigPos, 0x40)))
            v := byte(0, mload(add(signatures, add(sigPos, 0x60))))
        }
    }

    /**
     * @dev Calls a target address, sends value and / or data payload.
     * @param to Destination address.
     * @param value Amount to send in ETH.
     * @param data Data payload.
     * @param txGas Amount of gas to forward.
     */
    function _call(
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

    /**
     * @dev Calculates the gas price.
     */
    function calculateGasPrice(
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas
    ) internal view returns (uint256 gasPrice) {
        if (maxFeePerGas == maxPriorityFeePerGas) {
            // Legacy mode.
            gasPrice = maxFeePerGas;
        } else {
            gasPrice = min(maxFeePerGas, maxPriorityFeePerGas + block.basefee);
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
