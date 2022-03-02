// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "../libraries/UserOperation.sol";

interface IEIP4337 {
    /**
     * @dev Core interface to be EIP4337 compliant.
     * @param userOp the operation to be executed.
     * @param requestId The hash of the user's request data. Can be used as the basis for signature.
     * @param requiredPrefund the minimum amount to transfer to the sender(entryPoint) to be able to make the call.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 requestId,
        uint256 requiredPrefund
    ) external;
}
