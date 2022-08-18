// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.16;

import "../interfaces/ILaserModuleSSR.sol";
import "../interfaces/ILaserState.sol";

/**
 * @title LaserHelper
 *
 * @notice Allows to batch multiple requests in a single rpc call.
 */
contract LaserHelper {
    function getRequests(bytes[] calldata payload, address[] calldata _to) external view returns (bytes[] memory) {
        require(payload.length == _to.length, "Invalid request");

        bytes[] memory results = new bytes[](payload.length);

        for (uint256 i = 0; i < payload.length; i++) {
            address to = _to[i];

            bytes calldata callData = payload[i];

            (, bytes memory result) = to.staticcall(callData);

            results[i] = result;
        }

        return results;
    }
}
