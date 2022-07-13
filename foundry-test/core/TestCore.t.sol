pragma solidity 0.8.15;

import "forge-std/Test.sol";
import "../../contracts/LaserWallet.sol";
import "../../contracts/proxies/LaserFactory.sol";

contract TestCore is Test {
    LaserWallet singleton;
    LaserFactory factory;

    address owner;

    address[] recoveryOwners;
    address[] guardians;

    function setUp() public {
        singleton = new LaserWallet();
        factory = new LaserFactory(address(singleton));
        owner = vm.addr(1);
        recoveryOwners.push(vm.addr(2));
        recoveryOwners.push(vm.addr(3));
        guardians.push(vm.addr(4));
        guardians.push(vm.addr(5));
    }
}
