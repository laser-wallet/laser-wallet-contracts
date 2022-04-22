// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "./LaserProxy.sol";

interface IProxyCreationCallback {
    function proxyCreated(
        LaserProxy proxy,
        address _singleton,
        bytes calldata initializer,
        uint256 saltNonce
    ) external;
}
