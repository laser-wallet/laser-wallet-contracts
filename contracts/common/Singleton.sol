// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

/**
 * @title Singleton - Base for singleton contracts (should always be first super contract).
 * This contract is tightly coupled to our proxy contract (see `proxies/LaserProxy.sol`).
 * @author Modified from Gnosis Safe.
 */
contract Singleton {
    // singleton always needs to be first declared variable, to ensure that it is at the same location as in the Proxy contract.
    // It should also always be ensured that the address is stored alone (uses a full word)
    address private singleton;
}
