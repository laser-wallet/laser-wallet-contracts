// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../interfaces/IEIP1271.sol";

/**
 * @title MockUtils - Mocks utils library for testing.
 */
contract MockUtils {
    error Utils__returnSigner__invalidSignature();
    error Utils__returnSigner__invalidContractSignature();

    /**
     * @dev Returns the signer of the hash.
     * @param signedHash The hash that was signed.
     */
    function returnSigner(
        bytes32 signedHash,
        bytes memory signatures,
        uint256 pos
    ) public view returns (address signer) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        (r, s, v) = splitSigs(signatures, pos);

        if (v == 0) {
            // If v is 0, then it is a contract signature.
            // The address of the contract is encoded into r.
            signer = address(uint160(uint256(r)));

            // The signature(s) of the EOA's that control the target contract.
            bytes memory contractSignature;

            assembly {
                contractSignature := add(add(signatures, s), 0x20)
            }

            if (IEIP1271(signer).isValidSignature(signedHash, contractSignature) != 0x1626ba7e) {
                revert Utils__returnSigner__invalidContractSignature();
            }
        } else if (v > 30) {
            signer = ecrecover(
                keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", signedHash)),
                v - 4,
                r,
                s
            );
        } else {
            signer = ecrecover(signedHash, v, r, s);
        }

        if (signer == address(0)) revert Utils__returnSigner__invalidSignature();
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
    function call(
        address to,
        uint256 value,
        bytes memory data,
        uint256 txGas
    ) public returns (bool success) {
        assembly {
            // We execute a call to the target address and return a boolean (success, false).
            success := call(txGas, to, value, add(data, 0x20), mload(data), 0, 0)
        }
    }

    /**
     * @dev Calculates the gas price.
     */
    function calculateGasPrice(uint256 maxFeePerGas) public view returns (uint256 gasPrice) {
        return min(maxFeePerGas, tx.gasprice);
    }

    function min(uint256 a, uint256 b) public pure returns (uint256) {
        return a < b ? a : b;
    }
}
