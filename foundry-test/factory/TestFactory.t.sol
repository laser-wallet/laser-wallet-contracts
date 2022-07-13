pragma solidity 0.8.15;

import "forge-std/Test.sol";
import "../../contracts/LaserWallet.sol";
import "../../contracts/proxies/LaserFactory.sol";

contract TestFactory is Test {
    LaserWallet singleton;
    LaserFactory factory;
    address owner;

    function setUp() public {
        singleton = new LaserWallet();
        factory = new LaserFactory(address(singleton));
        owner = vm.addr(1);
    }

    function testSingletonStored() public {
        assertEq(factory.singleton(), address(singleton));
    }

    function testCannotUseInvalidSingleton() public {
        vm.expectRevert();
        new LaserFactory(address(0x1234));
    }

    function testDeployProxyAndRefund() public {
        uint256 salt = 1111;
        address[] memory guardians = new address[](2);
        address[] memory recoveryOwners = new address[](2);
        guardians[0] = vm.addr(4);
        guardians[1] = vm.addr(5);
        recoveryOwners[0] = vm.addr(2);
        recoveryOwners[1] = vm.addr(3);

        uint256 maxFeePerGas = 0;
        uint256 maxPriorityFeePerGas = 0;
        uint256 gasLimit = 0;
        bytes32 signedHash = keccak256(abi.encodePacked(maxFeePerGas, maxPriorityFeePerGas, gasLimit));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, signedHash);

        address signer = singleton.returnSigner(signedHash, r, s, v, "0x");
        console.log(signer);
        console.log(owner);
    }
}
