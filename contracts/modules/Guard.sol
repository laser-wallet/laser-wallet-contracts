// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.9;

import "../common/SelfAuthorized.sol";

/**
 * @title Guard - Base module. Provides extra transaction security.
 */
contract Guard is SelfAuthorized {
    // Maximum amount of Eth per transaction.
    uint256 public ethSpendingLimit;

    event NewSpendingLimit(uint256 amount);

    function initGuard(uint256 _ethSpendingLimit) internal {
        ethSpendingLimit = _ethSpendingLimit;
        emit NewSpendingLimit(_ethSpendingLimit);
    }

    /**
     * @dev Updates the spending limit.
     * @param _ethSpendingLimit New spending limit per transaction.
     */
    function updateEthSpendingLimit(uint256 _ethSpendingLimit)
        public
        authorized
    {
        require(_ethSpendingLimit > 0, "GUARD: ethSpendingLimit cannot be 0");
        ethSpendingLimit = _ethSpendingLimit;
        emit NewSpendingLimit(_ethSpendingLimit);
    }

    /**
     * @dev Eliminates spending limit checks.
     */
    function removeEthSpendingLimit() public authorized {
        ethSpendingLimit = 0;
        emit NewSpendingLimit(0);
    }

    /**
     * @dev Checks that the transaction's amount is less than the spending limit.
     * @param _amount Transaction amount in Eth.
     */
    function guard(uint256 _amount) internal view {
        require(
            _amount <= ethSpendingLimit,
            "GUARD: Transaction exceeds limit"
        );
    }
}
